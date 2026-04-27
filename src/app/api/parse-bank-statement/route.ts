import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseStatement } from '@/lib/statementParser'

export const maxDuration = 60

const client = new Anthropic()

// ─── TOOL DEFINITION — Forces Claude to output valid JSON ─────────────────────
const STATEMENT_TOOL = {
  name: 'submit_bank_statement',
  description: 'Submit the parsed bank statement data. Use this tool to return the structured transaction data extracted from the bank statement.',
  input_schema: {
    type: 'object' as const,
    properties: {
      bank: { type: 'string', description: 'Name of the bank (SBI, HDFC, ICICI, etc.)' },
      accountHolder: { type: 'string', description: 'Account holder name' },
      period: { type: 'string', description: 'Statement period e.g. "1 Mar 2025 - 31 Mar 2025"' },
      openingBalance: { type: 'number' },
      closingBalance: { type: 'number' },
      totalCredits: { type: 'number' },
      totalDebits: { type: 'number' },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string', enum: ['credit', 'debit'] },
            category: {
              type: 'string',
              enum: ['salary','rent','emi','grocery','food','fuel','shopping','entertainment','insurance','investment','sip','transfer','utility','medical','education','other']
            }
          },
          required: ['date','description','amount','type','category']
        }
      },
      summary: {
        type: 'object',
        properties: {
          salary: { type: 'number' },
          rent: { type: 'number' },
          emi: { type: 'number' },
          grocery: { type: 'number' },
          food: { type: 'number' },
          fuel: { type: 'number' },
          shopping: { type: 'number' },
          entertainment: { type: 'number' },
          insurance: { type: 'number' },
          investment: { type: 'number' },
          sip: { type: 'number' },
          utility: { type: 'number' },
          medical: { type: 'number' },
          education: { type: 'number' },
          other: { type: 'number' },
        },
        required: ['salary','rent','emi','grocery','food','fuel','shopping','entertainment','insurance','investment','sip','utility','medical','education','other']
      }
    },
    required: ['bank','accountHolder','period','openingBalance','closingBalance','totalCredits','totalDebits','transactions','summary']
  }
}

const SYSTEM = `You are a precise Indian bank statement parser. Extract ALL transactions from the bank statement provided.

Use the submit_bank_statement tool to return the parsed data. Categorise every transaction:
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

All amounts in INR rupees as plain numbers (no symbols, no commas). Sum amounts per category for the summary. If you cannot find transactions, submit with totalCredits=0, totalDebits=0, transactions=[].`

// Map ParseError to HTTP responses
function errorResponse(error: string, message?: string) {
  const responses: Record<string, { status: number; body: any }> = {
    incorrect_password: { status: 422, body: { error: 'incorrect_password' } },
    requires_password: { status: 422, body: { error: 'incorrect_password' } },
    aes_pdf_unsupported: { status: 415, body: { error: 'aes_pdf_unsupported', message: message || 'This PDF format isn\'t supported yet. Try Excel format.' } },
    unsupported_format: { status: 415, body: { error: 'unsupported_format', message: message || 'File type not supported.' } },
    corrupt_file: { status: 400, body: { error: 'corrupt_file', message: message || 'Could not read the file.' } },
    too_large: { status: 413, body: { error: 'too_large', message: message || 'File too large.' } },
  }
  const r = responses[error] || { status: 500, body: { error } }
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const log = (label: string) => console.log(`[bank-parse] ${label}: ${Date.now() - t0}ms`)
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''
    log('formData parsed')

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return errorResponse('too_large', 'Max 15MB')

    const buffer = Buffer.from(await file.arrayBuffer())
    log(`buffer ready (${file.size} bytes)`)

    const result = await parseStatement(buffer, file.name, file.type, password)
    log(`parseStatement done — ok=${result.ok}, kind=${result.kind}`)

    if (!result.ok) {
      return errorResponse(result.error || 'unsupported_format', result.errorMessage)
    }

    // Use tool calling — forces Claude to output structured JSON, validated by API
    let response
    try {
      log('calling Claude API')
      response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16000,
        system: SYSTEM,
        tools: [STATEMENT_TOOL as any],
        tool_choice: { type: 'tool', name: 'submit_bank_statement' } as any,
        messages: [{ role: 'user', content: result.claudeContent! }]
      })
      log('Claude API responded')
    } catch (apiErr: any) {
      log('Claude API failed')
      const msg = (apiErr.message || '').toLowerCase()
      if (msg.includes('password') || msg.includes('encrypted') || msg.includes('protect')) {
        return errorResponse('incorrect_password')
      }
      console.error('Claude API error:', apiErr)
      throw apiErr
    }

    // Extract tool input — guaranteed valid JSON from Anthropic
    const toolUse = response.content.find((c: any) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('No tool use in response. Stop reason:', response.stop_reason)
      return errorResponse('corrupt_file', 'Could not extract transactions. Try a different statement.')
    }

    const data = toolUse.input
    log('done')
    return NextResponse.json({ data, fileKind: result.kind })
  } catch (err: any) {
    log('caught error')
    console.error('Bank statement parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse statement' }, { status: 500 })
  }
}
