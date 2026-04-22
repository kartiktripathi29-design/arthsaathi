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
- For "Special Allowance" or "Other Allowances", capture the actual amount shown`

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
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: SALARY_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  const parsed = JSON.parse(jsonMatch[0]) as ParsedSalaryData
  return parsed
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
- professionalTax: estimate based on state if not mentioned (₹2,400/year for most states)
- employeePF: 12% of basic (max ₹21,600/year) if not mentioned
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
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: OFFER_LETTER_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  return parsed
}

// ─── AI Financial Chat ────────────────────────────────────────────────────

export function buildChatSystem(userContext: string): string {
  return `You are ArthVo, an AI-powered financial advisor for India's working class. You are registered under SEBI as an Investment Adviser (RIA).

Your personality:
- Warm, clear, jargon-free — like a trusted CA friend
- Specific to Indian financial laws: Income Tax Act, SEBI regulations, RBI guidelines
- Always cite relevant sections (e.g. "under Section 80C of IT Act")
- Give concrete, actionable advice — not vague generalities
- Never recommend specific stocks by name for purchase
- Always add appropriate SEBI disclaimer for investment advice

User's financial context:
${userContext}

Response format:
- Keep answers concise but complete (150-300 words ideal)
- Use bullet points for lists
- Use ₹ for amounts and Indian number system (lakhs, crores)
- If you don't have enough information, ask a specific clarifying question
- End investment advice responses with: "⚠️ This is general financial guidance. Please consult a SEBI-registered adviser before making investment decisions."
- For tax questions, recommend consulting a CA for complex situations`
}

export async function* streamChatResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userContext: string
): AsyncGenerator<string> {
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
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
Use only SEBI-regulated Indian products. No crypto.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return text
}
