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

const SALARY_PARSE_SYSTEM = `You are a precise Indian payroll document parser. Extract ALL salary components from any Indian payslip.

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no extra text.

Extract and return this exact JSON structure:
{
  "employeeName": "string (employee name from slip)",
  "employerName": "string (company name from slip)",
  "month": "string (e.g. March, April, January)",
  "year": "string (e.g. 2026, 2025)",
  "basicSalary": number (just basic, not including allowances),
  "hra": number (House Rent Allowance),
  "da": number (Dearness Allowance),
  "ta": number (Travel/Transport Allowance - sum all if multiple),
  "lta": number (Leave Travel Allowance),
  "medicalAllowance": number,
  "specialAllowance": number (any allowance labeled 'special'),
  "otherAllowances": number (sum of all OTHER allowances not listed above),
  "grossSalary": number (total earnings before deductions - MUST match slip's gross),
  "employeePF": number (Employee Provident Fund),
  "employerPF": number (Employer PF - if shown on slip),
  "esic": number (ESIC contribution),
  "professionalTax": number,
  "tdsDeducted": number (Income Tax / TDS),
  "loanDeduction": number,
  "otherDeductions": number (sum of any other deductions),
  "totalDeductions": number (total deductions - MUST match slip's total),
  "netSalary": number (take home pay - MUST match slip's net),
  "ctcMonthly": number (CTC if mentioned, else = grossSalary + employerPF),
  "ctcAnnual": number (CTC * 12),
  "components": [
    {"label": "string (allowance/deduction name)", "amount": number, "type": "earning|deduction|computed"}
  ]
}

RULES:
- ALL amounts are numbers only, no rupee symbols
- If a field is NOT on the slip, use 0
- grossSalary = sum of all earnings/allowances
- netSalary = grossSalary - totalDeductions (take-home pay shown on slip)
- otherAllowances = sum of allowances that don't fit specific categories (medical reimbursement, children education, hostel, LTA reimbursement, uniform, telephone, internet, books, helper, driver reimbursement, research, food coupon, hill area, tribal area, etc.)
- components array should include EVERY line item from the slip
- If slip shows gross and net, TRUST those numbers - they are correct
- Match component amounts exactly as shown on slip`

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
        text: 'Parse this salary slip. Return ONLY the JSON, nothing else.',
      },
    ]
  } else {
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
        text: 'Parse this salary slip. Return ONLY the JSON, nothing else.',
      },
    ]
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 1500,
    system: SALARY_PARSE_SYSTEM,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  console.log('[Parser] Claude response:', text.slice(0, 500))
  
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[Parser] No JSON found. Raw response:', text)
    throw new Error('Could not extract JSON from Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedSalaryData
  console.log('[Parser] Parsed successfully. Gross:', parsed.grossSalary, 'Net:', parsed.netSalary)
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
