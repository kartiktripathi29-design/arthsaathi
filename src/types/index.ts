// ─── Salary & Document Types ──────────────────────────────────────────────

export interface SalaryComponent {
  label: string
  amount: number
  type: 'earning' | 'deduction' | 'computed'
}

export interface ParsedSalaryData {
  employeeName: string
  employerName: string
  month: string
  year: string
  // Earnings
  basicSalary: number
  hra: number
  da: number              // Dearness Allowance
  ta: number              // Travel Allowance
  lta: number             // Leave Travel Allowance
  medicalAllowance: number
  specialAllowance: number
  otherAllowances: number
  grossSalary: number
  // Deductions
  employeePF: number
  employerPF: number
  esic: number
  professionalTax: number
  tdsDeducted: number
  loanDeduction: number
  otherDeductions: number
  totalDeductions: number
  // Computed
  netSalary: number       // Take-home
  ctcMonthly: number      // Cost to Company (monthly)
  ctcAnnual: number
  // Raw components for display
  components: SalaryComponent[]
}

// ─── Tax Types ────────────────────────────────────────────────────────────

export interface TaxDeductions {
  section80C: number          // EPF, PPF, ELSS, LIC etc — max 1.5L
  section80CCD1B: number      // NPS additional — max 50K
  section80D: number          // Health insurance — max 50K
  section24b: number          // Home loan interest — max 2L
  hraExemption: number        // Calculated separately
  standardDeduction: number   // 50K old / 75K new
  otherDeductions: number
}

export interface TaxResult {
  regime: 'old' | 'new'
  grossIncome: number
  totalDeductions: number
  taxableIncome: number
  basicTax: number
  surcharge: number
  cess: number
  totalTax: number
  effectiveRate: number       // percentage
  monthlyTDS: number          // monthly tax to deduct
  rebate87A: number
}

export interface TaxComparison {
  old: TaxResult
  new: TaxResult
  recommendation: 'old' | 'new'
  savings: number             // how much you save under recommended regime
  savingsPercent: number
}

// ─── Investment Types ─────────────────────────────────────────────────────

export interface FinancialGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: 'retirement' | 'education' | 'home' | 'emergency' | 'travel' | 'other'
}

export interface InvestmentRecommendation {
  product: string
  category: string
  allocationPercent: number
  monthlyAmount: number
  rationale: string
  expectedReturn: string
  riskLevel: 'low' | 'medium' | 'high'
  taxBenefit?: string
}

export interface PortfolioProjection {
  year: number
  corpus: number
  invested: number
}

export interface InvestmentPlan {
  monthlyInvestable: number
  recommendations: InvestmentRecommendation[]
  projections: PortfolioProjection[]
  financialHealthScore: number
  healthBreakdown: {
    savingsRate: number
    emergencyFund: number
    insuranceCoverage: number
    debtRatio: number
    investmentDiversity: number
  }
}

// ─── Chat Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface UserContext {
  salary?: ParsedSalaryData
  taxComparison?: TaxComparison
  goals?: FinancialGoal[]
}
