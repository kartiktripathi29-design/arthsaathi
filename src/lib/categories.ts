/**
 * Mega-category system + transaction tagging + salary detection + memory
 */

export type MegaCategory =
  | 'salary' | 'food' | 'shopping' | 'investments_elss' | 'investments_regular'
  | 'interest' | 'transport' | 'entertainment' | 'utilities' | 'healthcare'
  | 'housing' | 'insurance' | 'transfer' | 'cashback' | 'misc' | 'cc_payment'

export interface MegaCategoryInfo {
  key: MegaCategory
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  routesTo?: 'income' | 'expense' | 'investment' | 'transfer' | 'tax_save'
}

export const MEGA_CATEGORIES: Record<MegaCategory, MegaCategoryInfo> = {
  salary:               { key:'salary',               label:'Salary / Regular Income',  icon:'💰', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  interest:             { key:'interest',             label:'Interest / Dividends',     icon:'💸', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  cashback:             { key:'cashback',             label:'Cashbacks & Refunds',      icon:'🎁', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  food:                 { key:'food',                 label:'Food & Dining',            icon:'🍽️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  shopping:             { key:'shopping',             label:'Shopping',                 icon:'🛍️', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  investments_elss:     { key:'investments_elss',     label:'Tax-saving SIP (ELSS) → 80C', icon:'🛡️', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'tax_save' },
  investments_regular:  { key:'investments_regular',  label:'Regular SIP / Investments',icon:'📈', color:'#2A5A8A', bgColor:'#EEF4FD', borderColor:'#B5D4F4', routesTo:'investment' },
  transport:            { key:'transport',            label:'Transport & Fuel',         icon:'🚗', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  entertainment:        { key:'entertainment',        label:'Entertainment & OTT',      icon:'🎬', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  utilities:            { key:'utilities',            label:'Utilities & Recharges',    icon:'⚡', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  healthcare:           { key:'healthcare',           label:'Healthcare & Pharmacy',    icon:'💊', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  housing:              { key:'housing',              label:'Housing (Rent / EMI)',     icon:'🏠', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  insurance:            { key:'insurance',            label:'Insurance',                icon:'🛡️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  cc_payment:           { key:'cc_payment',           label:'Credit Card Payment',      icon:'💳', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
  transfer:             { key:'transfer',             label:'Personal Transfers',       icon:'👤', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'transfer' },
  misc:                 { key:'misc',                 label:'Miscellaneous',            icon:'📦', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
}

export const MERCHANT_RULES: Array<{ patterns: string[]; mega: MegaCategory; brandName?: string }> = [
  // Food
  { patterns:['SWIGGY'], mega:'food', brandName:'Swiggy' },
  { patterns:['ZOMATO'], mega:'food', brandName:'Zomato' },
  { patterns:['EATSURE'], mega:'food', brandName:'EatSure' },
  { patterns:['DOMINO','PIZZA HUT','MCDONALD','BURGER KING','SUBWAY','KFC'], mega:'food' },
  { patterns:['ZEPTO','BLINKIT','INSTAMART','BIGBASKET','DMART','GROFERS','DUNZO'], mega:'food', brandName:'Grocery' },
  // Shopping
  { patterns:['AMAZON'], mega:'shopping', brandName:'Amazon' },
  { patterns:['FLIPKART'], mega:'shopping', brandName:'Flipkart' },
  { patterns:['MYNTRA'], mega:'shopping', brandName:'Myntra' },
  { patterns:['MEESHO'], mega:'shopping', brandName:'Meesho' },
  { patterns:['NYKAA'], mega:'shopping', brandName:'Nykaa' },
  { patterns:['AJIO'], mega:'shopping', brandName:'Ajio' },
  { patterns:['PURPLLE'], mega:'shopping', brandName:'Purplle' },
  // Investments — default to regular SIP, user can mark as ELSS
  { patterns:['NEXTBILLION','BILLIONBRAINS','GROWW'], mega:'investments_regular', brandName:'Groww' },
  { patterns:['ZERODHA'], mega:'investments_regular', brandName:'Zerodha' },
  { patterns:['KUVERA'], mega:'investments_regular', brandName:'Kuvera' },
  { patterns:['PAYTM MONEY'], mega:'investments_regular', brandName:'Paytm Money' },
  { patterns:['INDMONEY'], mega:'investments_regular', brandName:'INDmoney' },
  { patterns:['ETMONEY'], mega:'investments_regular', brandName:'ETMoney' },
  { patterns:['MFCENTRAL','MF CENTRAL'], mega:'investments_regular' },
  { patterns:['SIP','MUTUAL FUND','MUTUAL F/'], mega:'investments_regular' },
  { patterns:['ICCL'], mega:'investments_regular', brandName:'Stock exchange' },
  // Interest / Dividends
  { patterns:['INT.PD','INT PD','INTEREST PAID','INTEREST CR'], mega:'interest', brandName:'Bank interest' },
  { patterns:['DIVIDEND','NHPC','COAL INDIA','POWER FINANCE','POWERGRID','ONGC','NTPC'], mega:'interest', brandName:'Dividend' },
  { patterns:['ECS Credit','ECS CR'], mega:'interest', brandName:'Dividend/ECS' },
  // Transport
  { patterns:['UBER'], mega:'transport', brandName:'Uber' },
  { patterns:['OLA'], mega:'transport', brandName:'Ola' },
  { patterns:['RAPIDO'], mega:'transport', brandName:'Rapido' },
  { patterns:['IRCTC'], mega:'transport', brandName:'IRCTC' },
  { patterns:['HPCL','BPCL','IOCL','INDIAN OIL','RELIANCE PETRO','SHELL'], mega:'transport', brandName:'Fuel' },
  { patterns:['IOCLIND','PETROL','PUMP'], mega:'transport', brandName:'Fuel' },
  // Entertainment
  { patterns:['NETFLIX'], mega:'entertainment', brandName:'Netflix' },
  { patterns:['HOTSTAR','DISNEY+'], mega:'entertainment', brandName:'Hotstar' },
  { patterns:['SPOTIFY'], mega:'entertainment', brandName:'Spotify' },
  { patterns:['PRIME VIDEO','AMAZON PRIME'], mega:'entertainment' },
  { patterns:['BOOKMYSHOW','BMS','PVR','INOX'], mega:'entertainment' },
  // Utilities
  { patterns:['AIRTEL'], mega:'utilities', brandName:'Airtel' },
  { patterns:['JIO'], mega:'utilities', brandName:'Jio' },
  { patterns:['VI ','VODAFONE','IDEA','BSNL'], mega:'utilities' },
  { patterns:['ELECTRICITY','BSES','TATA POWER','BESCOM','MSEDCL','TANGEDCO'], mega:'utilities' },
  { patterns:['INDIAN R/SBIN','IRUTS'], mega:'utilities', brandName:'Indian Railways' },
  // Healthcare
  { patterns:['APOLLO','MEDPLUS','1MG','NETMEDS','PHARMEASY'], mega:'healthcare' },
  { patterns:['POLICYBA','POLICYBAZAAR'], mega:'healthcare', brandName:'PolicyBazaar' },
  // Housing
  { patterns:['RENT','HOUSE RENT','HOME LOAN','MORTGAGE'], mega:'housing' },
  { patterns:['NACH','NACH DR','NACH DEBIT'], mega:'housing', brandName:'EMI/Loan' },
  // Insurance
  { patterns:['LIC','LIFE INSURANCE','TERM PLAN'], mega:'insurance' },
  // Cashback
  { patterns:['CASHBACK','REFUND','RETURN','REVERSAL'], mega:'cashback' },
  { patterns:['GPAYREFUND','GPAY REFUND'], mega:'cashback' },
  // Bank charges
  { patterns:['SMS CHARGE','BANK CHARGE','SERVICE CHARGE','GST'], mega:'misc' },
]

// Memory key — user-confirmed merchant → category mappings (persists across uploads)
const MEMORY_KEY = 'av_merchant_memory'

export function loadMerchantMemory(): Record<string, MegaCategory> {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}') } catch { return {} }
}

export function saveMerchantMemory(memory: Record<string, MegaCategory>) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)) } catch {}
}

// Given a description, extract the merchant key for memory lookup
export function extractMerchantKey(description: string): string {
  if (!description) return ''
  const desc = description.toUpperCase()
  // Try matching known patterns first — return the FIRST pattern that matches
  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) return p.toUpperCase()
    }
  }
  // Fallback: first 20 chars uppercase
  return desc.substring(0, 25).trim()
}

export function matchMega(description: string, currentCategory?: string, memory?: Record<string, MegaCategory>): { mega: MegaCategory; brand?: string } {
  if (!description) return { mega: 'misc' }
  const desc = description.toUpperCase()

  // Check memory first — user's previous decisions
  if (memory) {
    const key = extractMerchantKey(description)
    if (memory[key]) return { mega: memory[key] }
  }

  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) return { mega: rule.mega, brand: rule.brandName }
    }
  }
  const fallback: Record<string, MegaCategory> = {
    salary:'salary', rent:'housing', emi:'housing',
    grocery:'food', food:'food', fuel:'transport',
    shopping:'shopping', entertainment:'entertainment',
    insurance:'insurance', investment:'investments_regular', sip:'investments_regular',
    transfer:'transfer', utility:'utilities', medical:'healthcare',
    education:'misc', other:'misc'
  }
  if (currentCategory && fallback[currentCategory]) return { mega: fallback[currentCategory] }
  return { mega: 'misc' }
}

// Detect credit card payment based on user-provided card details
export function isCreditCardPayment(description: string, cards: Array<{bank:string; last4:string}>): boolean {
  if (!description || !cards?.length) return false
  const desc = description.toUpperCase()
  for (const card of cards) {
    if (card.last4 && desc.includes(card.last4)) return true
    if (card.bank && desc.includes(card.bank.toUpperCase()) && (desc.includes('CC') || desc.includes('CREDIT CARD') || desc.includes('PAYMENT'))) return true
  }
  return false
}

export function tagTransactions(transactions: any[], cards: Array<{bank:string; last4:string}> = []): any[] {
  if (!transactions) return []
  const memory = typeof window !== 'undefined' ? loadMerchantMemory() : {}
  return transactions.map((t, i) => {
    let { mega, brand } = matchMega(t.description, t.category, memory)
    // Override to credit card payment if matches user's cards
    if (t.type === 'debit' && isCreditCardPayment(t.description, cards)) {
      mega = 'cc_payment'
      const matched = cards.find(c => (t.description||'').toUpperCase().includes(c.last4))
      brand = matched ? `${matched.bank} ****${matched.last4}` : 'Credit card'
    }
    const id = `t_${i}_${(t.date||'').replace(/[-/]/g,'')}_${Math.round(t.amount)}`
    return { ...t, id, mega, brand }
  })
}

export interface SalaryCandidate {
  source: string
  averageAmount: number
  totalAmount: number
  occurrences: number
  variance: number
  transactions: any[]
  confidence: 'high' | 'medium' | 'low'
}

export function detectSalaryCandidates(transactions: any[]): SalaryCandidate[] {
  const credits = transactions.filter((t:any) => t.type === 'credit' && t.amount >= 5000)
  const groups: Record<string, any[]> = {}
  credits.forEach((t:any) => {
    const desc = (t.description || '').trim()
    let key = desc.split(/[/—-]/)[0].trim().substring(0, 30).toUpperCase()
    if (!key) key = 'UNKNOWN'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })

  const candidates: SalaryCandidate[] = []
  Object.entries(groups).forEach(([source, txns]) => {
    if (txns.length < 1) return
    const amounts = txns.map((t:any) => t.amount)
    const avg = amounts.reduce((a:number, b:number) => a + b, 0) / amounts.length
    const maxDev = txns.length > 1 ? Math.max(...amounts.map((a:number) => Math.abs(a - avg) / avg)) : 0
    if (avg < 8000) return
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (txns.length >= 3 && maxDev < 0.20 && avg >= 15000) confidence = 'high'
    else if (txns.length >= 2 && maxDev < 0.30 && avg >= 10000) confidence = 'medium'
    else if (txns.length >= 1 && avg >= 15000) confidence = 'low'
    else return
    candidates.push({
      source,
      averageAmount: Math.round(avg),
      totalAmount: amounts.reduce((a:number,b:number) => a + b, 0),
      occurrences: txns.length,
      variance: maxDev,
      transactions: txns,
      confidence
    })
  })

  const order = { high: 0, medium: 1, low: 2 }
  return candidates.sort((a, b) => order[a.confidence] - order[b.confidence] || b.averageAmount - a.averageAmount)
}

// Generate expense suggestions from tagged transactions and bank months
export interface ExpenseSuggestion {
  id: string
  mega: MegaCategory
  label: string
  icon: string
  monthlyAmount: number
  totalAmount: number
  count: number
  brands: string[]
  targetField: 'fixed' | 'variable' | 'savings' | 'tax_save' | 'cc'
  targetLabel: string  // e.g. "Groceries" — which field in Expenses tab
  description: string
}

export function generateExpenseSuggestions(transactions: any[], months: number, salaryIds: Set<string>, parkedIds: Set<string>): ExpenseSuggestion[] {
  const suggestions: ExpenseSuggestion[] = []

  // Group by mega category
  const grouped: Record<string, any[]> = {}
  transactions.forEach(t => {
    if (t.type !== 'debit') return
    if (salaryIds.has(t.id) || parkedIds.has(t.id)) return
    const k = t.mega || 'misc'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(t)
  })

  const fieldMap: Record<string, { target: ExpenseSuggestion['targetField']; label: string }> = {
    food: { target: 'variable', label: 'Dining out / Takeaway' },
    shopping: { target: 'variable', label: 'Shopping / Clothing' },
    transport: { target: 'variable', label: 'Fuel / Transport' },
    entertainment: { target: 'variable', label: 'Entertainment / OTT' },
    healthcare: { target: 'variable', label: 'Medicine / Healthcare' },
    utilities: { target: 'fixed', label: 'Electricity / Gas / Internet' },
    housing: { target: 'fixed', label: 'Rent / Home loan EMI' },
    insurance: { target: 'fixed', label: 'Insurance' },
    investments_elss: { target: 'tax_save', label: 'ELSS (80C)' },
    investments_regular: { target: 'savings', label: 'SIP / Mutual Funds' },
    cc_payment: { target: 'cc', label: 'Credit card bill' },
  }

  Object.entries(grouped).forEach(([mega, txns]) => {
    if (!fieldMap[mega]) return  // skip transfer, misc — not auto-suggested
    const total = txns.reduce((s,t) => s + t.amount, 0)
    if (total < 200) return
    const monthly = Math.round(total / months)
    const brands = Array.from(new Set(txns.map(t => t.brand).filter(Boolean))) as string[]
    const info = MEGA_CATEGORIES[mega as MegaCategory]
    suggestions.push({
      id: `sugg_${mega}`,
      mega: mega as MegaCategory,
      label: info?.label || mega,
      icon: info?.icon || '📦',
      monthlyAmount: monthly,
      totalAmount: total,
      count: txns.length,
      brands,
      targetField: fieldMap[mega].target,
      targetLabel: fieldMap[mega].label,
      description: brands.length > 0
        ? `${brands.slice(0,3).join(' + ')}${brands.length>3?'...':''} = ₹${monthly.toLocaleString('en-IN')}/mo`
        : `${txns.length} transactions = ₹${monthly.toLocaleString('en-IN')}/mo`,
    })
  })

  return suggestions.sort((a,b) => b.monthlyAmount - a.monthlyAmount)
}
