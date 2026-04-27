import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic()

const SYSTEM = `You are a precise Indian bank statement parser. Extract ALL transactions from any Indian bank statement.

Return ONLY valid JSON. No markdown:
{
  "bank": "string",
  "accountHolder": "string",
  "period": "string",
  "openingBalance": number,
  "closingBalance": number,
  "totalCredits": number,
  "totalDebits": number,
  "transactions": [
    { "date": "string", "description": "string", "amount": number, "type": "credit|debit", "category": "salary|rent|emi|grocery|food|fuel|shopping|entertainment|insurance|investment|sip|transfer|utility|medical|education|other" }
  ],
  "summary": {
    "salary": number, "rent": number, "emi": number, "grocery": number,
    "food": number, "fuel": number, "shopping": number, "entertainment": number,
    "insurance": number, "investment": number, "sip": number, "utility": number,
    "medical": number, "education": number, "other": number
  }
}

Rules:
- All amounts in INR rupees as numbers (no symbols)
- Categorise every transaction by description
- salary: SALARY, NEFT from employer, payroll
- rent: RENT, house rent
- emi: EMI, loan repayment, NACH
- sip: SIP, mutual fund, ZERODHA, GROWW, KUVERA
- investment: RD, FD, PPF, NPS contributions
- food: Swiggy, Zomato, restaurants, hotels, cafes
- grocery: BigBasket, DMart, supermarkets
- fuel: petrol pump, HPCL, BPCL, Indian Oil, Ola/Uber/Rapido
- entertainment: Netflix, Hotstar, Spotify, movies, gaming
- shopping: Amazon, Flipkart, Myntra, retail
- utility: electricity, gas, internet, mobile
- medical: pharmacy, hospital, doctor
- education: school fees, courses
- transfer: UPI to individuals, NEFT/IMPS to persons
- other: everything else`

async function parseExcel(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  let allText = ''
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    allText += `\n=== Sheet: ${name} ===\n${csv}\n`
  })
  return allText
}

async function unlockPdf(buffer: Buffer, password: string): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false, password } as any)
    return Buffer.from(await pdfDoc.save())
  } catch (e: any) {
    if (e.message?.includes('encrypted') || e.message?.includes('password')) {
      throw new Error('incorrect_password')
    }
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || file.type.includes('spreadsheet') || file.type.includes('excel')

    let messageContent: any[] = []

    if (isExcel) {
      // Parse Excel to CSV-like text and send to Claude
      const csvText = await parseExcel(buffer)
      if (csvText.length > 500_000) return NextResponse.json({ error: 'Excel file too large to process' }, { status: 400 })
      messageContent = [
        { type: 'text', text: `Parse this bank statement Excel data:\n\n${csvText}` }
      ]
    } else {
      // PDF — try to unlock if password provided
      let pdfBuffer = buffer
      if (password) {
        try {
          pdfBuffer = await unlockPdf(buffer, password)
        } catch (e: any) {
          if (e.message === 'incorrect_password') {
            return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
          }
        }
      }
      const base64 = pdfBuffer.toString('base64')
      messageContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: 'Parse this Indian bank statement and return the complete JSON.' }
      ]
    }

    let response
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: messageContent }]
      })
    } catch (apiErr: any) {
      // PDF likely password-protected if Claude can't read it
      if (apiErr.message?.includes('encrypted') || apiErr.message?.includes('password') || apiErr.status === 400) {
        if (!password && !isExcel) {
          return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
        }
      }
      throw apiErr
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not extract bank statement data')
    const data = JSON.parse(jsonMatch[0])

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Bank statement parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse statement' }, { status: 500 })
  }
}
