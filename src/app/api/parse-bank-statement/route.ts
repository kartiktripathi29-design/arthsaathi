import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseStatement } from '@/lib/statementParser'

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
- other: everything else

If the data is unclear or you cannot find transactions, return JSON with totalCredits=0, totalDebits=0, transactions=[], and an empty summary.`

// Map ParseError to HTTP responses
function errorResponse(error: string, message?: string) {
  const responses: Record<string, { status: number; body: any }> = {
    incorrect_password: { status: 422, body: { error: 'incorrect_password' } },
    requires_password: { status: 422, body: { error: 'incorrect_password' } },  // same as incorrect — frontend opens modal
    aes_pdf_unsupported: { status: 415, body: { error: 'aes_pdf_unsupported', message: message || 'This PDF format isn\'t supported yet. Try Excel format.' } },
    unsupported_format: { status: 415, body: { error: 'unsupported_format', message: message || 'File type not supported.' } },
    corrupt_file: { status: 400, body: { error: 'corrupt_file', message: message || 'Could not read the file.' } },
    too_large: { status: 413, body: { error: 'too_large', message: message || 'File too large.' } },
  }
  const r = responses[error] || { status: 500, body: { error } }
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return errorResponse('too_large', 'Max 15MB')

    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse — handles all formats, encryption, etc.
    const result = await parseStatement(buffer, file.name, file.type, password)

    if (!result.ok) {
      return errorResponse(result.error || 'unsupported_format', result.errorMessage)
    }

    // Send to Claude for JSON extraction
    let response
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: result.claudeContent! }]
      })
    } catch (apiErr: any) {
      const msg = (apiErr.message || '').toLowerCase()
      if (msg.includes('password') || msg.includes('encrypted') || msg.includes('protect')) {
        return errorResponse('incorrect_password')
      }
      throw apiErr
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return errorResponse('corrupt_file', 'Could not extract transactions from this statement.')
    }
    const data = JSON.parse(jsonMatch[0])

    return NextResponse.json({ data, fileKind: result.kind })
  } catch (err: any) {
    console.error('Bank statement parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse statement' }, { status: 500 })
  }
}
