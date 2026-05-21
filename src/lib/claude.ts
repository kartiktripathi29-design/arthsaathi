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

// ─── Offer Letter Parser ─────────────────────────────────────────────────

const OFFER_LETTER_PARSE_SYSTEM = `You are a precise Indian offer letter parser.`

export async function parseOfferLetterFromBase64(
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
): Promise<any> {
  const isImage = mediaType.startsWith('image/')
  let content: Anthropic.MessageParam['content']

  if (isImage) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64Data } },
      { type: 'text', text: 'Parse this offer letter and return JSON.' },
    ]
  } else {
    content = [
      { type: 'document' as any, source: { type: 'base64', media_type: 'application/pdf', data: base64Data } } as any,
      { type: 'text', text: 'Parse this offer letter and return JSON.' },
    ]
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-1-20250805',
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

export async function parseOfferLetterMultiPage(
  pages: { base64: string; mediaType: string }[]
): Promise<any> {
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
      text: `Parse these offer letter pages and return JSON.`,
    },
  ]

  const response = await client.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 1200,
    system: 'Parse offer letters',
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not extract JSON from Claude response')

  return JSON.parse(jsonMatch[0])
}

// ─── AI Financial Chat ────────────────────────────────────────────────────

export function buildChatSystem(userContext: string): string {
  return `You are ArthVo, an AI-powered financial advisor for India's working class.`
}

export async function* streamChatResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userContext: string
): AsyncGenerator<string> {
  const stream = await client.messages.stream({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 1000,
    system: buildChatSystem(userContext),
    messages,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      yield chunk.delta.text
    }
  }
}

export async function generateInvestmentPlan(
  monthlyInvestable: number,
  annualIncome: number,
  age: number,
  goals: string[],
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
): Promise<string> {
  const prompt = `Generate investment plan`

  const response = await client.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return text
}
