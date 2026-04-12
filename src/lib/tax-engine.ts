/**
 * ArthSaathi Tax Engine — AY 2025-26 (FY 2024-25)
 * Implements both Old and New Tax Regimes accurately
 * Handles surcharge, cess, rebate u/s 87A, HRA exemption
 */

import type { TaxDeductions, TaxResult, TaxComparison, ParsedSalaryData } from '@/types'

// ─── Slab Calculators ────────────────────────────────────────────────────

function calcOldRegimeTax(taxableIncome: number): number {
  let tax = 0
  if (taxableIncome <= 250000) return 0
  if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05
  } else if (taxableIncome <= 1000000) {
    tax = 12500 + (taxableIncome - 500000) * 0.20
  } else {
    tax = 112500 + (taxableIncome - 1000000) * 0.30
  }
  return tax
}

function calcNewRegimeTax(taxableIncome: number): number {
  let tax = 0
  if (taxableIncome <= 300000) return 0
  if (taxableIncome <= 700000) {
    tax = (taxableIncome - 300000) * 0.05
  } else if (taxableIncome <= 1000000) {
    tax = 20000 + (taxableIncome - 700000) * 0.10
  } else if (taxableIncome <= 1200000) {
    tax = 50000 + (taxableIncome - 1000000) * 0.15
  } else if (taxableIncome <= 1500000) {
    tax = 80000 + (taxableIncome - 1200000) * 0.20
  } else {
    tax = 140000 + (taxableIncome - 1500000) * 0.30
  }
  return tax
}

function calcSurcharge(income: number, basicTax: number): number {
  if (income <= 5000000) return 0
  if (income <= 10000000) return basicTax * 0.10
  if (income <= 20000000) return basicTax * 0.15
  if (income <= 50000000) return basicTax * 0.25
  return basicTax * 0.37
}

function calcRebate87A(taxableIncome: number, basicTax: number, regime: 'old' | 'new'): number {
  if (regime === 'old' && taxableIncome <= 500000) return Math.min(basicTax, 12500)
  if (regime === 'new' && taxableIncome <= 700000) return Math.min(basicTax, 25000)
  return 0
}

// ─── HRA Exemption Calculator ─────────────────────────────────────────────

export function calcHRAExemption(
  basicSalary: number,
  hra: number,
  rentPaidMonthly: number,
  isMetroCity: boolean
): number {
  const annualBasic = basicSalary * 12
  const annualHRA = hra * 12
  const annualRent = rentPaidMonthly * 12

  if (rentPaidMonthly === 0) return 0

  const cityPercent = isMetroCity ? 0.50 : 0.40
  const hraExempt = Math.min(
    annualHRA,                                    // actual HRA received
    annualBasic * cityPercent,                    // 50%/40% of basic
    annualRent - annualBasic * 0.10              // rent paid - 10% of basic
  )
  return Math.max(0, hraExempt)
}

// ─── Main Tax Calculator ──────────────────────────────────────────────────

export function calcOldRegime(
  annualGross: number,
  deductions: TaxDeductions
): TaxResult {
  const totalDeductions =
    Math.min(deductions.section80C, 150000) +
    Math.min(deductions.section80CCD1B, 50000) +
    Math.min(deductions.section80D, 50000) +
    Math.min(deductions.section24b, 200000) +
    deductions.hraExemption +
    Math.min(deductions.standardDeduction, 50000) +
    deductions.otherDeductions

  const taxableIncome = Math.max(0, annualGross - totalDeductions)
  const basicTax = calcOldRegimeTax(taxableIncome)
  const rebate = calcRebate87A(taxableIncome, basicTax, 'old')
  const taxAfterRebate = Math.max(0, basicTax - rebate)
  const surcharge = calcSurcharge(taxableIncome, taxAfterRebate)
  const cess = (taxAfterRebate + surcharge) * 0.04
  const totalTax = taxAfterRebate + surcharge + cess

  return {
    regime: 'old',
    grossIncome: annualGross,
    totalDeductions,
    taxableIncome,
    basicTax,
    surcharge,
    cess,
    totalTax: Math.round(totalTax),
    effectiveRate: annualGross > 0 ? parseFloat(((totalTax / annualGross) * 100).toFixed(2)) : 0,
    monthlyTDS: Math.round(totalTax / 12),
    rebate87A: rebate,
  }
}

export function calcNewRegime(annualGross: number): TaxResult {
  const standardDeduction = 75000
  const taxableIncome = Math.max(0, annualGross - standardDeduction)
  const basicTax = calcNewRegimeTax(taxableIncome)
  const rebate = calcRebate87A(taxableIncome, basicTax, 'new')
  const taxAfterRebate = Math.max(0, basicTax - rebate)
  const surcharge = calcSurcharge(taxableIncome, taxAfterRebate)
  const cess = (taxAfterRebate + surcharge) * 0.04
  const totalTax = taxAfterRebate + surcharge + cess

  return {
    regime: 'new',
    grossIncome: annualGross,
    totalDeductions: standardDeduction,
    taxableIncome,
    basicTax,
    surcharge,
    cess,
    totalTax: Math.round(totalTax),
    effectiveRate: annualGross > 0 ? parseFloat(((totalTax / annualGross) * 100).toFixed(2)) : 0,
    monthlyTDS: Math.round(totalTax / 12),
    rebate87A: rebate,
  }
}

export function compareTaxRegimes(
  salary: ParsedSalaryData,
  deductions: TaxDeductions,
  rentPaidMonthly = 0,
  isMetroCity = true
): TaxComparison {
  const annualGross = salary.grossSalary * 12

  const hraExemption = calcHRAExemption(
    salary.basicSalary,
    salary.hra,
    rentPaidMonthly,
    isMetroCity
  )

  const oldResult = calcOldRegime(annualGross, { ...deductions, hraExemption })
  const newResult = calcNewRegime(annualGross)

  const recommendation: 'old' | 'new' = oldResult.totalTax <= newResult.totalTax ? 'old' : 'new'
  const savings = Math.abs(oldResult.totalTax - newResult.totalTax)
  const higherTax = Math.max(oldResult.totalTax, newResult.totalTax)
  const savingsPercent = higherTax > 0 ? parseFloat(((savings / higherTax) * 100).toFixed(1)) : 0

  return { old: oldResult, new: newResult, recommendation, savings, savingsPercent }
}

// ─── Tax Slab Breakdown (for charts) ─────────────────────────────────────

export function getSlabBreakdown(taxableIncome: number, regime: 'old' | 'new') {
  if (regime === 'new') {
    return [
      { slab: '₹0 – ₹3L', rate: '0%', tax: 0 },
      { slab: '₹3L – ₹7L', rate: '5%', tax: Math.min(Math.max(0, taxableIncome - 300000), 400000) * 0.05 },
      { slab: '₹7L – ₹10L', rate: '10%', tax: Math.min(Math.max(0, taxableIncome - 700000), 300000) * 0.10 },
      { slab: '₹10L – ₹12L', rate: '15%', tax: Math.min(Math.max(0, taxableIncome - 1000000), 200000) * 0.15 },
      { slab: '₹12L – ₹15L', rate: '20%', tax: Math.min(Math.max(0, taxableIncome - 1200000), 300000) * 0.20 },
      { slab: '₹15L+', rate: '30%', tax: Math.max(0, taxableIncome - 1500000) * 0.30 },
    ].filter(s => s.tax > 0)
  }
  return [
    { slab: '₹0 – ₹2.5L', rate: '0%', tax: 0 },
    { slab: '₹2.5L – ₹5L', rate: '5%', tax: Math.min(Math.max(0, taxableIncome - 250000), 250000) * 0.05 },
    { slab: '₹5L – ₹10L', rate: '20%', tax: Math.min(Math.max(0, taxableIncome - 500000), 500000) * 0.20 },
    { slab: '₹10L+', rate: '30%', tax: Math.max(0, taxableIncome - 1000000) * 0.30 },
  ].filter(s => s.tax > 0)
}

// ─── Deduction Suggestions ────────────────────────────────────────────────

export function getDeductionSuggestions(
  salary: ParsedSalaryData,
  currentDeductions: TaxDeductions
) {
  const suggestions = []
  const empPFAnnual = salary.employeePF * 12

  const used80C = Math.min(currentDeductions.section80C + empPFAnnual, 150000)
  const gap80C = 150000 - used80C
  if (gap80C > 5000) {
    suggestions.push({
      section: '80C',
      current: used80C,
      max: 150000,
      gap: gap80C,
      products: ['ELSS mutual fund', 'PPF', 'NSC', 'Tax-saver FD'],
      potentialSaving: Math.round(gap80C * 0.30),
    })
  }

  if (currentDeductions.section80CCD1B < 50000) {
    const gap = 50000 - currentDeductions.section80CCD1B
    suggestions.push({
      section: '80CCD(1B) — NPS',
      current: currentDeductions.section80CCD1B,
      max: 50000,
      gap,
      products: ['NPS Tier 1'],
      potentialSaving: Math.round(gap * 0.30),
    })
  }

  if (currentDeductions.section80D < 25000) {
    const gap = 25000 - currentDeductions.section80D
    suggestions.push({
      section: '80D — Health Insurance',
      current: currentDeductions.section80D,
      max: 25000,
      gap,
      products: ['Family floater health insurance'],
      potentialSaving: Math.round(gap * 0.30),
    })
  }

  return suggestions
}

// ─── Formatters ───────────────────────────────────────────────────────────

export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatINRFull(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
