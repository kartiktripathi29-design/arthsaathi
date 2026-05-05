import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseStatement, detectFileKind } from '@/lib/statementParser'
import { parseExcelFileLocally } from '@/lib/localExcelParser'
import { runPipeline, stage2_normalize, stage3_categorize, stage4_analyze, stage5_report } from '@/lib/pipeline'
import type { ParseResult, RawTransaction, PipelineReport } from '@/lib/pipeline'
import { analyzeStatement } from '@/lib/txn-intelligence'
import type { IntelligenceReport } from '@/lib/txn-intelligence'

export const maxDuration = 120

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const log = (s: string) => console.log(`[bank-parse] ${s}: ${Date.now() - t0}ms`)

  try {
    let buffer: Buffer
    let fileName = 'statement'
    let fileType = ''
    let password = ''

    // Check if this is a blob URL request (JSON body) or direct file upload (FormData)
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      // Blob URL mode — download file from Vercel Blob
      const body = await req.json()
      const blobUrl = body.blobUrl
      password = body.password || ''
      fileName = body.fileName || 'statement'
      fileType = body.fileType || ''
      log(`blob mode: downloading from ${blobUrl}`)

      const blobRes = await fetch(blobUrl)
      if (!blobRes.ok) return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
      buffer = Buffer.from(await blobRes.arrayBuffer())
      log(`blob downloaded (${buffer.length} bytes)`)

      // Clean up blob after download
      try {
        const { del } = await import('@vercel/blob')
        await del(blobUrl)
        log('blob deleted')
      } catch {}
    } else {
      // Direct file upload mode (for files under 4.5MB)
      const form = await req.formData()
      const file = form.get('file') as File | null
      password = (form.get('password') as string) || ''
      log('form parsed')

      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
      if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 })

      buffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
      fileType = file.type
      log(`direct upload (${file.size} bytes)`)
    }

    // ─── FAST PATH: Excel/CSV → parse locally + run pipeline ────────────
    const fileKind = detectFileKind(buffer, fileName, fileType)
    if (fileKind === 'excel-xlsx' || fileKind === 'excel-xls' || fileKind === 'csv') {
      log(`fast path: ${fileKind} — parsing locally`)
      try {
        const localResult = await parseExcelFileLocally(buffer, fileName, password)
        if (localResult && localResult.transactions.length >= 2) {
          log(`local parse done — ${localResult.transactions.length} transactions`)

          // ─── RUN PIPELINE on locally parsed data ──────────────────────
          try {
            const { pipelineReport, intelligence } = runPipelineFromLocalResult(localResult)
            log(`pipeline done — ${pipelineReport.total_transactions} txns, ${pipelineReport.categorization_summary.auto_classified} auto-classified`)
            return NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind,
              parsedLocally: true,
            })
          } catch (pipeErr: any) {
            log(`pipeline failed: ${pipeErr.message} — returning raw parse only`)
            return NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind,
              parsedLocally: true,
            })
          }
          // ──────────────────────────────────────────────────────────────
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

    // ─── FAST PATH: PDF → try local template parser before Haiku ────────
    if (fileKind === 'pdf') {
      try {
        const { parseLocalPdf } = await import('@/lib/localPdfParser')
        const localResult = await parseLocalPdf(buffer)
        if (localResult && localResult.transactions.length >= 2) {
          log(`local PDF parse done — ${localResult.transactions.length} txns`)
          const v = localResult.validation
          log(`validation: ${v.matches ? 'MATCHES ✓' : 'MISMATCH ✗ (' + v.computedClosing + ' vs ' + v.actualClosing + ')'}`)

          // Run pipeline on PDF result too
          try {
            const { pipelineReport, intelligence } = runPipelineFromLocalResult(localResult)
            log(`pipeline done — ${pipelineReport.total_transactions} txns`)
            return NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind: 'pdf',
              parsedLocally: true,
            })
          } catch (pipeErr: any) {
            log(`pipeline failed on PDF: ${pipeErr.message}`)
            return NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind: 'pdf',
              parsedLocally: true,
            })
          }
        }
        log('local PDF parse: unknown bank or too few transactions — falling through to Haiku')
      } catch (e: any) {
        if (e.message === 'requires_password') {
          log('local PDF parse: password required — falling through to statementParser')
        } else {
          log(`local PDF parse failed: ${e.message} — falling through to Haiku`)
        }
      }
    }
    // ─── END FAST PATHS ─────────────────────────────────────────────────

    const result = await parseStatement(buffer, fileName, fileType, password) as any
    log(`parseStatement done — ok=${result.ok}, kind=${result.kind}`)

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Parse failed' }, { status: 422 })
    }

    // The Haiku parseStatement returns the parsed data on result itself
    // (fields: transactions, bank, accountHolder, etc.)
    // Try to run pipeline if we have transactions
    let pipelineReport: PipelineReport | null = null
    let intelligence: IntelligenceReport | null = null
    const haikuData = result.data ?? result
    if (haikuData.transactions?.length >= 2) {
      try {
        const pipeResult = runPipelineFromLocalResult(haikuData)
        pipelineReport = pipeResult.pipelineReport
        intelligence = pipeResult.intelligence
        log(`pipeline on Haiku result — ${pipelineReport.total_transactions} txns`)
      } catch (pipeErr: any) {
        log(`pipeline failed on Haiku result: ${pipeErr.message}`)
      }
    }

    return NextResponse.json({
      data: haikuData,
      pipeline: pipelineReport,
      intelligence,
      fileKind: result.kind,
      parsedLocally: false,
    })
  } catch (err: any) {
    console.error('[bank-parse] error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}


// ─── BRIDGE: Convert localExcelParser/localPdfParser output → pipeline ──────
//
// The pipeline's runPipeline() expects raw spreadsheet rows (number[][]).
// But localExcelParser already parsed those rows into a structured result.
// This bridge converts the structured result into pipeline input format,
// then runs stages 2-5 (skipping stage 1's row parsing since it's done).
// ────────────────────────────────────────────────────────────────────────────

function runPipelineFromLocalResult(localResult: any): { pipelineReport: PipelineReport; intelligence: IntelligenceReport } {
  // Convert localResult.transactions → RawTransaction[]
  const rawTxns: RawTransaction[] = (localResult.transactions || []).map((t: any, idx: number) => {
    // Handle both field naming conventions
    const debit = t.debit ?? t.withdrawal ?? t.withdrawalAmt ?? null
    const credit = t.credit ?? t.deposit ?? t.depositAmt ?? null
    const balance = t.balance ?? t.closingBalance ?? 0

    // Parse date to ISO format
    let txnDate = t.date || t.txnDate || t.txn_date || ''
    txnDate = normalizeDate(txnDate)

    let valueDate = t.valueDate || t.value_date || t.valueDt || txnDate
    valueDate = normalizeDate(valueDate)

    const narration = t.narration || t.description || t.particulars || t.narration_raw || ''
    const ref = t.refNo || t.chqRefNo || t.chq_ref_no || t.chequeNo || ''

    return {
      txn_index: idx,
      txn_date: txnDate,
      value_date: valueDate,
      narration_raw: narration,
      chq_ref_no: String(ref),
      debit: typeof debit === 'number' && debit > 0 ? debit : null,
      credit: typeof credit === 'number' && credit > 0 ? credit : null,
      balance: typeof balance === 'number' ? balance : 0,
    }
  })

  // Build a ParseResult from localResult metadata
  const parseResult: ParseResult = {
    bank: detectBankFromName(localResult.bank || ''),
    account_number: localResult.accountNumber || '',
    account_holder: localResult.accountHolder || '',
    ifsc: localResult.ifsc || '',
    statement_period: {
      from: rawTxns[0]?.txn_date || '',
      to: rawTxns[rawTxns.length - 1]?.txn_date || '',
    },
    opening_balance: localResult.openingBalance || 0,
    closing_balance: localResult.closingBalance || 0,
    transactions: rawTxns,
    validation: {
      passed: localResult.validation?.matches !== false,
      row_arithmetic_ok: true,
      summary_reconciliation_ok: localResult.validation?.matches !== false,
      date_monotonicity_ok: true,
      errors: [],
      warnings: [],
    },
  }

  // Run stages 2-5 (pipeline)
  const normalizedTxns = stage2_normalize(parseResult)
  const categorizedTxns = stage3_categorize(normalizedTxns)
  const analysis = stage4_analyze(categorizedTxns)
  const pipelineReport = stage5_report(parseResult, categorizedTxns, analysis)

  // Run v3 intelligence engine (WHAT→WHY→WHO→CLASSIFY)
  const intelligenceInput = rawTxns.map(t => ({
    narration: t.narration_raw,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
    date: t.txn_date,
  }))
  const intelligence = analyzeStatement(intelligenceInput, parseResult.account_holder)

  return { pipelineReport, intelligence }
}


// ─── HELPERS ────────────────────────────────────────────────────────────────

function normalizeDate(d: string): string {
  if (!d) return ''
  const s = String(d).trim()

  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YY
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (m1) {
    const yr = parseInt(m1[3]) < 50 ? 2000 + parseInt(m1[3]) : 1900 + parseInt(m1[3])
    return `${yr}-${m1[2]}-${m1[1]}`
  }

  // DD/MM/YYYY
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`

  // DD-MM-YYYY
  const m3 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`

  // DD-MMM-YYYY or DD MMM YYYY
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  const m4 = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})$/)
  if (m4) {
    const mon = months[m4[2].toUpperCase()]
    if (mon) {
      const yr = m4[3].length === 2
        ? (parseInt(m4[3]) < 50 ? '20' + m4[3] : '19' + m4[3])
        : m4[3]
      return `${yr}-${mon}-${m4[1].padStart(2, '0')}`
    }
  }

  // JS Date object stringified (from Excel date cells)
  try {
    const dt = new Date(s)
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split('T')[0]
    }
  } catch {}

  return s
}

type BankId =
  | 'HDFC' | 'SBI' | 'KOTAK' | 'BOB' | 'PNB' | 'PSB' | 'SCB'
  | 'CANARA' | 'ICICI' | 'AXIS' | 'BOI' | 'IB' | 'BOM' | 'YES'
  | 'CBI' | 'IOB' | 'IDBI' | 'FEDERAL' | 'UCO' | 'BANDHAN'
  | 'RBL' | 'INDUSIND' | 'UNKNOWN'

function detectBankFromName(name: string): BankId {
  const n = name.toUpperCase()
  const map: [string, BankId][] = [
    ['HDFC', 'HDFC'], ['SBI', 'SBI'], ['STATE BANK', 'SBI'],
    ['KOTAK', 'KOTAK'], ['BOB', 'BOB'], ['BANK OF BARODA', 'BOB'],
    ['PNB', 'PNB'], ['PUNJAB NATIONAL', 'PNB'],
    ['PSB', 'PSB'], ['PUNJAB & SIND', 'PSB'], ['PUNJAB AND SIND', 'PSB'],
    ['STANDARD CHARTERED', 'SCB'], ['CANARA', 'CANARA'],
    ['ICICI', 'ICICI'], ['AXIS', 'AXIS'],
    ['BANK OF INDIA', 'BOI'], ['BOI', 'BOI'],
    ['INDIAN BANK', 'IB'], ['BANK OF MAHARASHTRA', 'BOM'],
    ['YES BANK', 'YES'], ['CENTRAL BANK', 'CBI'],
    ['INDIAN OVERSEAS', 'IOB'], ['IDBI', 'IDBI'],
    ['FEDERAL', 'FEDERAL'], ['UCO', 'UCO'],
    ['BANDHAN', 'BANDHAN'], ['RBL', 'RBL'],
    ['INDUSIND', 'INDUSIND'],
  ]
  for (const [signal, id] of map) {
    if (n.includes(signal)) return id
  }
  return 'UNKNOWN'
}
