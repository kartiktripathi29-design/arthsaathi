/**
 * Local PDF Parser for Indian Bank Statements
 * =============================================
 * Template-based: knows exact column positions per bank.
 * Uses unpdf (pure JS, works on Vercel) to extract text with X/Y coordinates.
 * Determines debit/credit by column X position AND balance-diff validation.
 * 
 * Currently supports: HDFC Bank
 * Next: SBI, ICICI, Axis (same approach, different column positions)
 */

// @ts-ignore — unpdf ships ESM-only
const getUnpdf = () => import('unpdf')

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  balance?: number
  category: string
}

interface ParsedResult {
  bank: string
  accountHolder: string
  accountNumber: string
  period: string
  openingBalance: number
  closingBalance: number
  totalCredits: number
  totalDebits: number
  transactions: ParsedTransaction[]
  summary: Record<string, number>
  validation: { computedClosing: number; actualClosing: number; matches: boolean }
}

interface TextCell {
  x: number
  y: number
  text: string
}

// ── Amount parser: handles Indian lakh format (1,08,450.00) ──
function parseIndianAmount(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '')) || 0
}

// ── Simple category detection ──
function categorize(desc: string, type: string): string {
  if (!desc) return 'other'
  const d = desc.toUpperCase()
  if (type === 'credit') {
    if (/SALARY|PAYROLL|SAL CR/.test(d)) return 'salary'
    if (/INTEREST|INT\.PD|INT CR/.test(d)) return 'other'
    if (/FREELANCE/.test(d)) return 'other'
    return 'other'
  }
  if (/EMI|HOME LOAN|CAR LOAN|PERSONAL LOAN|EDUCATION LOAN|GOLD LOAN|LAPTOP LOAN|CONSUMER DURABLE/.test(d)) return 'emi'
  if (/RENT/.test(d)) return 'rent'
  if (/SIP|MUTUAL FUND|BLUECHIP|MID CAP|PARAG PARIKH/.test(d)) return 'sip'
  if (/PPF|NPS/.test(d)) return 'investment'
  if (/LIC|INSURANCE|STAR HEALTH|MEDICLAIM/.test(d)) return 'insurance'
  if (/SWIGGY|ZOMATO/.test(d)) return 'food'
  if (/BIGBASKET|D.MART|DMART|ZEPTO|BLINKIT/.test(d)) return 'grocery'
  if (/AMAZON|FLIPKART|MYNTRA|AJIO|LENSKART|DECATHLON/.test(d)) return 'shopping'
  if (/UBER|OLA|RAPIDO|PETROL|HPCL|BPCL|IOCL|FUEL/.test(d)) return 'fuel'
  if (/ELECTRICITY|BESCOM|BWSSB|WATER|BROADBAND|AIRTEL|JIO|RECHARGE/.test(d)) return 'utility'
  if (/NETFLIX|HOTSTAR|SPOTIFY|BOOKMYSHOW|PVR/.test(d)) return 'entertainment'
  if (/APOLLO|PHARMACY|PRACTO|HOSPITAL|1MG|MEDPLUS/.test(d)) return 'medical'
  if (/CC AUTOPAY|CREDIT CARD|CRED/.test(d)) return 'other'
  if (/SELF TRANSFER|OWN A\/C/.test(d)) return 'transfer'
  if (/IMPS|NEFT.*PAYMENT|UPI.*PERSON/.test(d)) return 'transfer'
  return 'other'
}

// ── Detect bank from PDF text ──
function detectBank(headerText: string): string | null {
  const t = headerText.toUpperCase()
  if (t.includes('HDFC BANK') || t.includes('HDFCBANK')) return 'HDFC Bank'
  if (t.includes('STATE BANK') || t.includes('SBI ')) return 'SBI'
  if (t.includes('ICICI BANK')) return 'ICICI Bank'
  if (t.includes('AXIS BANK')) return 'Axis Bank'
  if (t.includes('KOTAK')) return 'Kotak Bank'
  if (t.includes('PUNJAB NATIONAL') || t.includes('PNB')) return 'PNB'
  return null
}

// ── Year resolver for DD-Mon dates ──
function resolveDate(shortDate: string, headerText: string): string {
  const monthMap: Record<string, number> = {
    'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,
    'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12
  }
  const parts = shortDate.split('-')
  if (parts.length !== 2) return shortDate
  const day = parts[0]
  const monthStr = parts[1]
  const monthNum = monthMap[monthStr]
  if (!monthNum) return shortDate

  // Extract year range from header: "01-OCT-2025 TO 31-MAR-2026"
  const yearMatch = headerText.match(/(\d{4})\s*TO\s*\d{2}-[A-Z]{3}-(\d{4})/i)
    || headerText.match(/(\d{4}).*?(\d{4})/)
  if (yearMatch) {
    const startYear = parseInt(yearMatch[1])
    const endYear = parseInt(yearMatch[2] || yearMatch[1])
    const year = (monthNum >= 10 || endYear === startYear) ? startYear : (monthNum <= 3 && endYear > startYear ? endYear : startYear)
    return `${day}-${monthStr}-${year}`
  }
  return `${day}-${monthStr}-${new Date().getFullYear()}`
}

// ══════════════════════════════════════════════════════════════════════════
// HDFC BANK TEMPLATE
// Column X positions (from actual HDFC PDF analysis):
//   Date: ~43    Description: ~115    Ref: ~305
//   Debit: ~416-425    Credit: ~471-476    Balance: ~521
// ══════════════════════════════════════════════════════════════════════════

const HDFC_TEMPLATE = {
  // X position thresholds for distinguishing debit vs credit
  debitXMin: 390,
  debitXMax: 460,
  creditXMin: 460,
  creditXMax: 510,
  balanceXMin: 510,
  dateXMax: 80,
  descXMin: 100,
  refXMin: 280,
}

function parseHDFCRows(pages: TextCell[][]): { rows: Array<{ date: string; desc: string; ref: string; amounts: Array<{x: number; value: number}> }>; headerText: string } {
  const rows: Array<{ date: string; desc: string; ref: string; amounts: Array<{x: number; value: number}> }> = []
  let headerText = ''
  const T = HDFC_TEMPLATE

  for (let pi = 0; pi < pages.length; pi++) {
    const cells = pages[pi]
    
    // Collect header text from first page
    if (pi === 0) {
      headerText = cells.map(c => c.text).join(' ')
    }

    // Group cells by Y position
    const yRows = new Map<number, TextCell[]>()
    for (const cell of cells) {
      const y = Math.round(cell.y)
      if (!yRows.has(y)) yRows.set(y, [])
      yRows.get(y)!.push(cell)
    }

    // Process each row (sorted top to bottom = highest Y first)
    const sortedYs = [...yRows.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const rowCells = yRows.get(y)!.sort((a, b) => a.x - b.x)
      
      // Check if first cell is a date (DD-Mon)
      const firstCell = rowCells[0]
      if (!firstCell || firstCell.x > T.dateXMax) continue
      if (!/^\d{2}-[A-Za-z]{3}$/.test(firstCell.text.trim())) continue

      const date = firstCell.text.trim()
      let desc = ''
      let ref = ''
      const amounts: Array<{x: number; value: number}> = []

      for (let i = 1; i < rowCells.length; i++) {
        const cell = rowCells[i]
        const x = cell.x
        const text = cell.text.trim()

        // Is this an amount? (digits, commas, decimal point)
        if (/^[\d,]+\.\d{2}$/.test(text)) {
          amounts.push({ x, value: parseIndianAmount(text) })
        } else if (x >= T.descXMin && x < T.refXMin) {
          desc += (desc ? ' ' : '') + text
        } else if (x >= T.refXMin && x < T.debitXMin) {
          ref += (ref ? ' ' : '') + text
        }
      }

      if (amounts.length > 0) {
        rows.push({ date, desc, ref, amounts })
      }
    }
  }

  return { rows, headerText }
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PARSER
// ══════════════════════════════════════════════════════════════════════════

export async function parseLocalPdf(buffer: Buffer): Promise<ParsedResult | null> {
  const unpdf = await getUnpdf()
  
  let pdf: any
  try {
    pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer))
  } catch (e: any) {
    const msg = (e.message || '').toLowerCase()
    if (msg.includes('password') || msg.includes('encrypt')) {
      throw new Error('requires_password')
    }
    return null
  }

  // Extract text cells from all pages
  const pages: TextCell[][] = []
  let allText = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const cells: TextCell[] = []
    
    for (const item of content.items) {
      if (!item.str?.trim()) continue
      cells.push({
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        text: item.str,
      })
      if (i === 1) allText += ' ' + item.str
    }
    pages.push(cells)
  }

  // Detect bank
  const bank = detectBank(allText)
  if (!bank) return null // Unknown bank — let Haiku handle it

  // Parse based on bank template
  const T = HDFC_TEMPLATE // For now, only HDFC
  const { rows, headerText } = parseHDFCRows(pages)
  if (rows.length < 3) return null

  // Extract account info
  const accMatch = allText.match(/Account Number:\s*([\d\s]+)/)
  const accountNumber = accMatch ? accMatch[1].replace(/\s/g, '') : ''
  const holderMatch = allText.match(/Account Holder:\s*([A-Z][A-Z\s]+?)(?:\s{2,}|PAN)/)
  const accountHolder = holderMatch ? holderMatch[1].trim() : ''

  // Build transactions using balance-diff method
  const transactions: ParsedTransaction[] = []
  let prevBalance: number | null = null
  let openingBalance = 0
  let totalCredits = 0
  let totalDebits = 0

  for (const row of rows) {
    // Opening balance row: description says "Opening Balance", only 1 amount
    if (row.desc.includes('Opening Balance')) {
      const balAmt = row.amounts.find(a => a.x >= T.balanceXMin)
      if (balAmt) {
        openingBalance = balAmt.value
        prevBalance = openingBalance
      }
      continue
    }

    // Transaction row: find the transaction amount and balance
    // Balance is always the rightmost amount (highest X)
    const sorted = [...row.amounts].sort((a, b) => b.x - a.x)
    if (sorted.length < 2) continue

    const balance = sorted[0].value // Rightmost = balance
    const txnAmt = sorted[1].value // Second from right = transaction amount
    const txnX = sorted[1].x       // X position tells us debit vs credit

    // PRIMARY: determine type from X position
    let type: 'credit' | 'debit'
    if (txnX >= T.creditXMin) {
      type = 'credit'
    } else if (txnX < T.creditXMin) {
      type = 'debit'
    } else {
      type = 'debit' // default
    }

    // VALIDATION: cross-check with balance change
    if (prevBalance !== null) {
      const diff = balance - prevBalance
      const expectedType = diff > 0 ? 'credit' : 'debit'
      if (Math.abs(Math.abs(diff) - txnAmt) < 1) {
        // Balance diff matches transaction amount — use balance-diff result (most reliable)
        type = expectedType
      }
    }

    const fullDate = resolveDate(row.date, headerText)
    const category = categorize(row.desc, type)

    if (type === 'credit') totalCredits += txnAmt
    else totalDebits += txnAmt

    transactions.push({
      date: fullDate,
      description: row.desc,
      amount: Math.round(txnAmt * 100) / 100,
      type,
      balance: Math.round(balance * 100) / 100,
      category,
    })

    prevBalance = balance
  }

  if (transactions.length < 2) return null

  const closingBalance = transactions[transactions.length - 1].balance || 0
  const computedClosing = Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100

  // Build summary
  const summary: Record<string, number> = {
    salary:0, rent:0, emi:0, grocery:0, food:0, fuel:0, shopping:0,
    entertainment:0, insurance:0, investment:0, sip:0, utility:0,
    medical:0, education:0, transfer:0, other:0
  }
  transactions.forEach(t => {
    if (t.type === 'debit' && summary[t.category] !== undefined) {
      summary[t.category] += t.amount
    }
  })

  const dates = transactions.map(t => t.date).sort()
  const period = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : ''

  return {
    bank,
    accountHolder,
    accountNumber,
    period,
    openingBalance: Math.round(openingBalance * 100) / 100,
    closingBalance: Math.round(closingBalance * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    transactions,
    summary,
    validation: {
      computedClosing,
      actualClosing: closingBalance,
      matches: Math.abs(computedClosing - closingBalance) < 1,
    },
  }
}
