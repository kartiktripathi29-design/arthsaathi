/**
 * ArthVo — Anthropic Claude Integration
 * Handles salary slip parsing (multimodal) + AI chat
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSalaryData } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─── Salary Slip Parser ───────────────────────────────────────────────────

const SALARY_PARSE_SYSTEM = `You are a precise Indian payroll document parser. Extract ALL salary components from any Indian payslip — regardless of format, employer, or layout.

Return ONLY valid JSON. No markdown, no explanation. Use this exact schema:
{
  "employeeName": "string",
  "employerName": "string",
  "pan": "string (10-char PAN like AAAPL1234C if visible, else empty string)",
  "aadhaarLast4": "string (last 4 digits of Aadhaar if visible, else empty string)",
  "month": "string (e.g. March)",
  "year": "string (e.g. 2024)",
  "basicSalary": number,
  "hra": number,
  "da": number,
  "ta": number,
  "lta": number,
  "medicalAllowance": number,
  "specialAllowance": number,
  "otherAllowances": number,
  "grossSalary": number,
  "employeePF": number,
  "employerPF": number,
  "esic": number,
  "professionalTax": number,
  "tdsDeducted": number,
  "loanDeduction": number,
  "otherDeductions": number,
  "totalDeductions": number,
  "netSalary": number,
  "ctcMonthly": number,
  "ctcAnnual": number,
  "components": [
    {"label": "string", "amount": number, "type": "earning|deduction|computed"}
  ]
}

Rules:
- All amounts in INR rupees (numbers only, no symbols)
- If a field is not present, use 0
- grossSalary = sum of all earnings before deductions
- netSalary = take-home pay (grossSalary - totalDeductions)
- ctcMonthly = grossSalary + employerPF + ESIC employer share + gratuity provision
- ctcAnnual = ctcMonthly * 12
- Include ALL visible components in the components array
- Common Indian allowances: Basic, HRA, DA, TA/Conveyance, LTA, Medical, Special Allowance, Night Shift, Statutory Bonus
- Common deductions: PF/EPF, ESIC, Professional Tax (PT/P.Tax), TDS, Loans, Salary Advance
- If gross doesn't match sum of components, trust the printed gross
- For "Special Allowance" or "Other Allowances", capture the actual amount shown
- PAN: extract the 10-character Permanent Account Number EXACTLY as printed (uppercase). If absent, use empty string ""
- Aadhaar: many slips show only the last 4 digits ("XXXX XXXX 1234"). Return just those 4 digits as a string. If absent, use empty string ""`

export async function parseSalaryFromBase64(
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<ParsedSalaryData> {
  const isImage = mediaType.startsWith('image/')

  let content: Anthropic.MessageParam['content']

  if (isImage) {
    content = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: 'Parse this Indian salary slip and return the JSON as specified. Extract every number you can see accurately.',
      },
    ]
  } else {
    // PDF — send as document
    content = [
      {
        type: 'document' as any,
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      } as any,
      {
        type: 'text',
        text: 'Parse this Indian salary slip PDF and return the JSON as specified.',
      },
    ]
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: SALARY_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  const parsed = JSON.parse(jsonMatch[0]) as ParsedSalaryData
  return parsed
}

// Excel/CSV salary slips can't be sent to the vision model — the route converts the workbook to
// CSV-like text and parses it here using the same schema/prompt as the image/PDF path.
export async function parseSalaryFromText(sheetText: string): Promise<ParsedSalaryData> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: SALARY_PARSE_SYSTEM,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: `Parse this Indian salary slip, exported as spreadsheet/CSV text, and return the JSON as specified. Extract every number accurately.\n\n${sheetText}`,
      }],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')
  return JSON.parse(jsonMatch[0]) as ParsedSalaryData
}

// ─── Offer Letter Parser ─────────────────────────────────────────────────

const OFFER_LETTER_PARSE_SYSTEM = `You are a precise Indian offer letter parser. Extract ALL compensation components from any Indian offer letter — regardless of company, format, or layout.

Return ONLY valid JSON. No markdown, no explanation. Use this exact schema:
{
  "employeeName": "string",
  "employerName": "string",
  "designation": "string",
  "joiningDate": "string",
  "basicSalary": number,
  "hra": number,
  "da": number,
  "ta": number,
  "lta": number,
  "medicalAllowance": number,
  "specialAllowance": number,
  "otherAllowances": number,
  "performanceBonus": number,
  "joiningBonus": number,
  "retentionBonus": number,
  "esopValue": number,
  "gratuity": number,
  "employeePF": number,
  "employerPF": number,
  "professionalTax": number,
  "fixedCTC": number,
  "variableCTC": number,
  "totalCTC": number,
  "components": [
    {"label": "string", "amount": number, "type": "fixed|variable|deduction|benefit", "frequency": "monthly|annual|one-time"}
  ],
  "notes": "string"
}

Rules:
- All amounts in INR rupees ANNUAL (numbers only, no symbols)
- If monthly amounts shown, multiply by 12
- fixedCTC = guaranteed annual pay (basic + HRA + all fixed allowances + employer PF)
- variableCTC = bonus + incentives + ESOPs (not guaranteed)
- totalCTC = fixedCTC + variableCTC
- joiningBonus and retentionBonus are one-time, mark frequency as "one-time"
- ESOPs: use vesting value if mentioned, else 0
- Include ALL components in the components array with correct frequency
- Do NOT estimate or impute any amount. Only return figures actually stated in the document.
- employeePF, employerPF, professionalTax: use the stated value, else 0 — never assume a default
- If a field is not present, use 0
- notes: any important conditions (bond period, variable payout conditions, ESOP vesting schedule)`

export async function parseOfferLetterFromBase64(
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<any> {
  const isImage = mediaType.startsWith('image/')

  let content: Anthropic.MessageParam['content']

  if (isImage) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64Data } },
      { type: 'text', text: 'Parse this Indian offer letter and return the JSON as specified. Extract every compensation component accurately.' },
    ]
  } else {
    content = [
      { type: 'document' as any, source: { type: 'base64', media_type: 'application/pdf', data: base64Data } } as any,
      { type: 'text', text: 'Parse this Indian offer letter PDF and return the JSON as specified.' },
    ]
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: OFFER_LETTER_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  return parsed
}

// Offer letters that arrive as encrypted PDFs are decrypted and text-extracted by pdfjs upstream
// (pdf-lib can't decrypt AES), then parsed here as text using the same schema/prompt as the PDF path.
export async function parseOfferLetterFromText(text: string): Promise<any> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: OFFER_LETTER_PARSE_SYSTEM,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: `Parse this Indian offer letter, extracted as plain text from a PDF, and return the JSON as specified. Extract every compensation component accurately.\n\n${text}`,
      }],
    }],
  })

  const t = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = t.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')
  return JSON.parse(jsonMatch[0])
}

export async function parseOfferLetterMultiPage(
  pages: { base64: string; mediaType: string }[]
): Promise<any> {
  // Send all pages as images in a single Claude call
  const content: Anthropic.MessageParam['content'] = [
    ...pages.map(p => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: p.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data: p.base64,
      },
    })),
    {
      type: 'text' as const,
      text: `These are ${pages.length} pages of an Indian offer letter. Parse ALL pages together and return the complete JSON as specified. Extract every compensation component accurately.`,
    },
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: OFFER_LETTER_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  return JSON.parse(jsonMatch[0])
}

// ─── AI Financial Chat ────────────────────────────────────────────────────

// Chat = an in-app GUIDE and EXPLAINER, not a financial/tax adviser (ArthVo is not SEBI-registered).
// It helps people use ArthVo, explains tax and investing concepts in depth, and may walk through how a
// rule applies to the user's OWN figures (as the app already computed them). It must NOT tell them what
// to do: no regime pick, no product/fund picks, no amounts to invest, no return predictions.
export function buildChatSystem(userContext: string): string {
  return `You are the ArthVo Guide — a friendly helper inside ArthVo, an Indian income-tax app for salaried
people. You help people use the app, and you explain tax and investing clearly. You are NOT a financial,
tax or investment adviser, and ArthVo is not a SEBI-registered investment adviser.

WHAT YOU DO:
- Tell people where to enter something (e.g. "FD interest goes under Other earnings → Interest & dividends").
- Explain what a field, label, allowance or term on the screen means, in plain English with simple examples.
- Explain Indian income-tax concepts properly — slabs, old vs new regime, the 87A rebate, standard
  deduction, HRA, 80C/80D/NPS limits, TDS, advance tax, capital gains, which ITR form applies and why.
  Use the rules for FY 2025-26 (the year the app computes).
- Explain how investment options work in general — FD, PPF, NPS, ELSS, equity/index/debt/liquid funds,
  Sukanya Samriddhi, insurance — their lock-in, risk and tax treatment, and the trade-offs between them.
- When the user's figures are given below, you may use them to show HOW a rule works out for them
  (e.g. "your tax under the new regime is computed like this…", "you've used ₹X of the ₹1.5 lakh 80C
  limit"). Only use figures given below or stated by the user — never invent or estimate their numbers.
  For a full tax figure, point them to the "Your Tax" page, which computes it.

WHAT YOU DO NOT DO (politely decline, then give the general explanation instead):
- No recommendations on what they should do: which regime to choose, whether or how much to invest,
  which product, fund, stock or insurer to pick, or how to split their money. Instead, explain the
  trade-offs in general terms and the facts that matter, and add: "For a recommendation on your own
  situation, check with a CA (for tax) or a SEBI-registered investment adviser (for investments)."
  It is fine to repeat what ArthVo computed (e.g. "Your Tax shows the new regime is ₹X lower for you") —
  that is a fact, not advice.
- No predictions of returns, markets or prices. Don't quote expected returns for any product.
- No crypto, F&O or stock tips.
- Don't invent ArthVo features. If you're not sure where something goes, say so and suggest the closest
  screen or their CA.

HOW ARTHVO IS ORGANISED (use this to point people to the right place):
- Documents — upload salary slips, AIS, Form 26AS, or an offer letter.
- Salary — your month-by-month salary for the year (built from slips / offer letter).
- Other earnings (Other Income) — Freelance/consulting, F&O/intraday, Interest & dividends (FD interest,
  savings-account interest, dividends go here), Capital gains (stocks/mutual funds — LTCG & STCG),
  Crypto/VDA, and "Other".
- Allowances (Section 10 exemptions) — HRA, LTA, gratuity, daily allowance, etc. (old regime only).
- Deductions (Chapter VI-A) — 80C, 80D (health insurance), 24(b) home-loan interest, NPS 80CCD(1B),
  80TTA, 80TTB, 80E, 80G (old regime only).
- Your Tax — compares Old vs New regime, shows your tax, which ITR form to file, and where you can save more.
- Dashboard — a visual summary of your tax picture.
- "Computation for your CA" — a printable statement to hand to a tax consultant.
- Investing basics — how common savings and investment options work (lock-in, risk, tax treatment).
Note: ArthVo has no dedicated house-property/rental section yet — for rental income, suggest "Other" under
Other earnings and to mention it to their CA.

STYLE:
- Clear and friendly, no jargon (or explain it). Short questions get 1-3 sentences; "how does this work"
  questions can take a short walkthrough of up to about 8 sentences or a few numbered steps.
- When pointing somewhere, name the exact screen (e.g. Other earnings → Interest & dividends).
- Use ₹ and Indian number style (lakh/crore).
- Write in plain text — NO markdown, no asterisks for bold, no "#" headings. Simple numbered lines are fine.

About this user (from what they entered in ArthVo — use to explain, never to advise):
${userContext || '(no data entered yet)'}`
}

export async function* streamChatResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userContext: string
): AsyncGenerator<string> {
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: buildChatSystem(userContext),
    messages,
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}

// ─── Investment Recommendation Generator ─────────────────────────────────

export async function generateInvestmentPlan(
  monthlyInvestable: number,
  annualIncome: number,
  age: number,
  goals: string[],
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
): Promise<string> {
  const prompt = `Generate a personalised investment plan for an Indian working professional:

Monthly investable amount: ₹${monthlyInvestable.toLocaleString('en-IN')}
Annual income: ₹${annualIncome.toLocaleString('en-IN')}
Age: ${age}
Goals: ${goals.join(', ')}
Risk profile: ${riskProfile}

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "product": "string",
      "category": "string",
      "allocationPercent": number,
      "monthlyAmount": number,
      "rationale": "string (1 sentence)",
      "expectedReturn": "string (e.g. '12-15% CAGR')",
      "riskLevel": "low|medium|high",
      "taxBenefit": "string or null"
    }
  ],
  "financialHealthScore": number (0-100),
  "healthBreakdown": {
    "savingsRate": number (0-100),
    "emergencyFund": number (0-100),
    "insuranceCoverage": number (0-100),
    "debtRatio": number (0-100),
    "investmentDiversity": number (0-100)
  },
  "topInsight": "string (most important advice in 2 sentences)"
}

Prioritise: emergency fund first, then tax-saving instruments (ELSS, NPS), then growth investments.
Use only established, regulated Indian investment products. No crypto.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return text
}
