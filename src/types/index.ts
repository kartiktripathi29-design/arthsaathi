// ─── Salary & Document Types ──────────────────────────────────────────────

export interface SalaryComponent {
  label: string
  amount: number
  type: 'earning' | 'deduction' | 'computed'
}

// ─── Other Income Sources (for ITR) ──────────────────────────────────────
export interface OtherIncomeData {
  // Dividend
  dividendIncome: number

  // Interest Income
  fdInterest: number           // FD interest income
  savingsInterest: number      // Savings bank interest
  otherInterest: number        // Bonds, debentures, etc

  // Gifts
  giftFromRelatives: number    // Tax exempt
  giftFromOthers: number       // Taxable above ₹50,000

  // Capital Gains (Annual)
  ltcgEquity: number           // LTCG from equity/MF (12.5% above ₹1.25L)
  stcgEquity: number           // STCG from equity/MF (20%)
  ltcgProperty: number         // LTCG from property (12.5%)
  stcgProperty: number         // STCG from property (slab rate)
  ltcgOther: number            // LTCG from debt/other
  stcgOther: number            // STCG from debt/other

  // House Property
  annualRentReceived: number   // Gross rent received
  municipalTaxPaid: number     // Actual municipal tax paid
  homeLoanInterest: number     // Home loan interest (Section 24b)
  isLetOut: boolean            // Let out or self-occupied

  // Business & Profession
  businessIncome: number       // Net profit from business
  professionalIncome: number   // Net income from profession/freelance
  presumptiveIncome: number    // 44AD/44ADA presumptive income
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

// ─── AIS / Income Types ───────────────────────────────────────────────────

export interface CapitalGainEntry {
  assetType: 'equity' | 'mutual_fund' | 'property' | 'other'
  assetName: string
  purchaseDate: string
  saleDate: string
  purchaseAmount: number
  saleAmount: number
  gain: number
  gainType: 'STCG' | 'LTCG'   // Short term or Long term
  taxRate: number               // 20% STCG equity, 12.5% LTCG equity
  taxPayable: number
}

export interface InterestIncome {
  source: string               // Bank name / FD details
  type: 'savings' | 'fd' | 'bonds' | 'other'
  grossAmount: number
  tdsDeducted: number
  netAmount: number
}

export interface OtherIncome {
  source: string
  type: 'dividend' | 'rental' | 'freelance' | 'business' | 'other'
  grossAmount: number
  tdsDeducted: number
}

export interface AISData {
  pan: string
  taxpayerName: string
  assessmentYear: string
  // TDS
  tdsEntries: {
    deductorName: string
    deductorTAN: string
    incomeType: string
    grossAmount: number
    tdsDeducted: number
    quarter: string
  }[]
  taxPayments: {
    type: string
    amount: number
    date: string
    bsrCode: string
  }[]
  totalTDSDeducted: number
  totalTaxPaid: number
  totalTaxCredit: number
  // Income sources
  salaryIncome: number
  interestIncome: InterestIncome[]
  capitalGains: CapitalGainEntry[]
  dividendIncome: number
  rentalIncome: number
  otherIncome: OtherIncome[]
  // Computed
  totalInterestIncome: number
  totalCapitalGains: number
  totalOtherIncome: number
  grandTotalIncome: number
  totalTaxOnAllIncome: number
  additionalTaxOverTDS: number  // Tax owed beyond TDS
  alerts: string[]              // Warning messages for user
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
