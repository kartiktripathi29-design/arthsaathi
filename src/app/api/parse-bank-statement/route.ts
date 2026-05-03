import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseStatement, detectFileKind } from '@/lib/statementParser'
import { parseExcelFileLocally } from '@/lib/localExcelParser'
import { parseLocalPdf } from '@/lib/localPdfParser'

export const maxDuration = 120

const client = new Anthropic()

const STATEMENT_TOOL = {
  name: 'submit_bank_statement',
  description: 'Submit parsed bank statement data',
  input_schema: {
    type: 'object' as const,
    properties: {
      bank: { type: 'string' },
      accountHolder: { type: 'string' },
      period: { type: 'string' },
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
            category: { type: 'string', enum: ['salary','rent','emi','grocery','food','fuel','shopping','entertainment','insurance','investment','sip','transfer','utility','medical','education','other'] }
          },
          required: ['date','description','amount','type','category']
        }
      },
      summary: {
        type: 'object',
        properties: {
          salary: { type: 'number' }, rent: { type: 'number' }, emi: { type: 'number' },
          grocery: { type: 'number' }, food: { type: 'number' }, fuel: { type: 'number' },
          shopping: { type: 'number' }, entertainment: { type: 'number' }, insurance: { type: 'number' },
          investment: { type: 'number' }, sip: { type: 'number' }, utility: { type: 'number' },
          medical: { type: 'number' }, education: { type: 'number' }, other: { type: 'number' }
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
All amounts as plain numbers. Sum per category for summary.`

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const log = (s: string) => console.log(`[bank-parse] ${s}: ${Date.now()-t0}ms`)

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''
    log('form parsed')

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > 15*1024*1024) return NextResponse.json({ error: 'too_large' }, { status: 413 })

    const buffer = Buffer.from(await file.arrayBuffer())
    log(`buffer ready (${file.size} bytes)`)

    // ─── FAST PATH: Excel/CSV → parse locally, skip Haiku ───────────────
    const fileKind = detectFileKind(buffer, file.name, file.type)
    if (fileKind === 'excel-xlsx' || fileKind === 'excel-xls' || fileKind === 'csv') {
      log(`fast path: ${fileKind} — parsing locally`)
      try {
        const localResult = await parseExcelFileLocally(buffer, file.name, password)
        if (localResult && localResult.transactions.length >= 2) {
          log(`local parse done — ${localResult.transactions.length} transactions`)
          return NextResponse.json({ data: localResult, fileKind, parsedLocally: true })
        }
        log('local parse returned too few transactions — falling through to Haiku')
      } catch (e: any) {
        if (e.message === 'requires_password') {
          return NextResponse.json({ error: 'requires_password' }, { status: 422 })
        }
        if (e.message === 'incorrect_password') {
          return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
        }
        log(`local parse failed: ${e.message} — falling through to Haiku`)
      }
    }

    // ─── FAST PATH: PDF → try local template parser for known banks ─────
    if (fileKind === 'pdf') {
      log('trying local PDF parser (template-based)')
      try {
        const localResult = await parseLocalPdf(buffer)
        if (localResult && localResult.transactions.length >= 2) {
          const v = localResult.validation
          log(`local PDF parse done — ${localResult.transactions.length} txns, bank=${localResult.bank}, balance ${v.matches ? 'MATCHES ✓' : 'MISMATCH ✗ ('+v.computedClosing+' vs '+v.actualClosing+')'}`)
          return NextResponse.json({ data: localResult, fileKind: 'pdf', parsedLocally: true })
        }
        log('local PDF parse: unknown bank or too few transactions — falling through to Haiku')
      } catch (e: any) {
        if (e.message === 'requires_password') {
          // Don't return error — let statementParser handle password flow
          log('local PDF parse: password required — falling through to statementParser')
        } else {
          log(`local PDF parse failed: ${e.message} — falling through to Haiku`)
        }
      }
    }
    // ─── END FAST PATHS ─────────────────────────────────────────────────

    const result = await parseStatement(buffer, file.name, file.type, password)
    log(`parseStatement done — ok=${result.ok}, kind=${result.kind}`)

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        incorrect_password: 422, requires_password: 422,
        aes_pdf_unsupported: 415, unsupported_format: 415,
        corrupt_file: 400, too_large: 413
      }
      return NextResponse.json(
        { error: result.error, message: result.errorMessage },
        { status: statusMap[result.error || ''] || 500 }
      )
    }

    log('calling Claude')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16000,
      system: SYSTEM,
      tools: [STATEMENT_TOOL as any],
      tool_choice: { type: 'tool', name: 'submit_bank_statement' } as any,
      messages: [{ role: 'user', content: result.claudeContent! }]
    })
    log('Claude done')

    const toolUse = response.content.find((c: any) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Could not extract transactions' }, { status: 500 })
    }

    log('done')
    return NextResponse.json({ data: toolUse.input, fileKind: result.kind })

  } catch (err: any) {
    log('error')
    console.error('Bank parse error:', err)
    const msg = (err.message || '').toLowerCase()
    if (msg.includes('password') || msg.includes('encrypted')) {
      return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
    }
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
