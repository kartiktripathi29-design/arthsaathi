// ============================================================================
// ArthVo Pipeline Engine — 5-Stage Bank Statement Processing
// ============================================================================
// STAGE 1: PARSE    — Detect bank, apply schema, extract canonical transactions
// STAGE 2: NORMALIZE — Extract counterparties, detect internal transfers & CC payments
// STAGE 3: CATEGORIZE — Classify each transaction with confidence scoring
// STAGE 4: ANALYZE  — Aggregates, recurring detection, salary/EMI detection
// STAGE 5: REPORT   — Structured output with anomalies
// ============================================================================

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface RawTransaction {
  txn_index: number;
  txn_date: string;          // ISO date: YYYY-MM-DD
  value_date: string;        // ISO date
  narration_raw: string;
  chq_ref_no: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

export interface CanonicalTransaction extends RawTransaction {
  narration_normalized: string;
  channel: TransactionChannel;
  counterparty: string;
  counterparty_type: CounterpartyType;
  is_internal_transfer: boolean;
  is_cc_payment: boolean;
  primary_category: string;
  secondary_category: string;
  is_pnl_item: boolean;
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
}

export type TransactionChannel =
  | 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'ACH' | 'NACH'
  | 'IB_BILLPAY' | 'EMI' | 'CC_AUTOPAY' | 'RD'
  | 'UPI_RETURN' | 'ATM' | 'CHEQUE' | 'POS' | 'OTHER';

export type CounterpartyType =
  | 'MERCHANT' | 'PERSON' | 'EMPLOYER' | 'SELF' | 'GOVERNMENT'
  | 'BANK_PRODUCT' | 'INVESTMENT' | 'INSURANCE' | 'UNKNOWN';

export interface ParseResult {
  bank: BankId;
  account_number: string;
  account_holder: string;
  ifsc: string;
  statement_period: { from: string; to: string };
  opening_balance: number;
  closing_balance: number;
  transactions: RawTransaction[];
  validation: ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  row_arithmetic_ok: boolean;
  summary_reconciliation_ok: boolean;
  date_monotonicity_ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface AnalysisResult {
  total_inflow: number;
  total_outflow: number;
  net_cashflow: number;
  inflow_by_channel: Record<string, number>;
  outflow_by_channel: Record<string, number>;
  top_counterparties_by_volume: { name: string; total: number; count: number }[];
  monthly_summary: MonthlySummary[];
  recurring_payments: RecurringPayment[];
  salary_credits: SalaryCredit[];
  emi_outflows: EmiOutflow[];
  investment_outflows: { name: string; total: number; count: number }[];
  insurance_premiums: { name: string; amount: number }[];
}

export interface MonthlySummary {
  month: string;  // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
  txn_count: number;
}

export interface RecurringPayment {
  counterparty: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'irregular';
  occurrences: number;
  dates: string[];
  category: string;
}

export interface SalaryCredit {
  employer: string;
  amount: number;
  date: string;
  auto_confirmed: boolean;
}

export interface EmiOutflow {
  description: string;
  amount: number;
  date: string;
  emi_id: string | null;
}

export interface PipelineReport {
  parse_status: 'success' | 'partial' | 'failed';
  bank: BankId;
  statement_period: { from: string; to: string };
  total_transactions: number;
  categorization_summary: {
    auto_classified: number;
    needs_review: number;
    internal_transfers: number;
    cc_payments: number;
  };
  session_totals: {
    total_inflow: number;
    total_outflow: number;
    net_cashflow: number;
  };
  anomalies: Anomaly[];
  analysis: AnalysisResult;
  transactions: CanonicalTransaction[];
}

export interface Anomaly {
  type: 'large_transaction' | 'spending_spike' | 'unusual_pattern' | 'balance_mismatch';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  txn_indices: number[];
}

// ---------------------------------------------------------------------------
// BANK SCHEMAS — 22 banks from parser reference
// ---------------------------------------------------------------------------

export type BankId =
  | 'HDFC' | 'SBI' | 'KOTAK' | 'BOB' | 'PNB' | 'PSB' | 'SCB'
  | 'CANARA' | 'ICICI' | 'AXIS' | 'BOI' | 'IB' | 'BOM' | 'YES'
  | 'CBI' | 'IOB' | 'IDBI' | 'FEDERAL' | 'UCO' | 'BANDHAN'
  | 'RBL' | 'INDUSIND' | 'UNKNOWN';

interface BankSchema {
  id: BankId;
  name: string;
  ifsc_prefix: string;
  date_format: string;       // DD/MM/YY, DD/MM/YYYY, DD-MMM-YYYY, DD MMM YYYY etc.
  columns: {
    date: string;
    narration: string;
    ref: string;
    value_date: string | null;
    debit: string;
    credit: string;
    balance: string;
  };
  detection_signals: string[];  // strings to look for in header/metadata
}

const BANK_SCHEMAS: BankSchema[] = [
  {
    id: 'HDFC', name: 'HDFC Bank', ifsc_prefix: 'HDFC0',
    date_format: 'DD/MM/YY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Chq./Ref.No.', value_date: 'Value Dt', debit: 'Withdrawal Amt.', credit: 'Deposit Amt.', balance: 'Closing Balance' },
    detection_signals: ['HDFC BANK', 'HDFC0', 'hdfc bank ltd']
  },
  {
    id: 'SBI', name: 'State Bank of India', ifsc_prefix: 'SBIN0',
    date_format: 'DD MMM YYYY',
    columns: { date: 'Txn Date', narration: 'Description', ref: 'Ref No./Cheque No.', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['STATE BANK OF INDIA', 'SBIN0', 'SBI', 'YONO']
  },
  {
    id: 'KOTAK', name: 'Kotak Mahindra Bank', ifsc_prefix: 'KKBK0',
    date_format: 'DD-MMM-YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Chq/Ref No', value_date: null, debit: 'Withdrawal (Dr)', credit: 'Deposit (Cr)', balance: 'Balance' },
    detection_signals: ['KOTAK', 'KKBK0', 'KOTAK MAHINDRA']
  },
  {
    id: 'BOB', name: 'Bank of Baroda', ifsc_prefix: 'BARB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Tran Date', narration: 'Description / Narration', ref: 'Cheque No.', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['BANK OF BARODA', 'BARB0', 'BOB WORLD']
  },
  {
    id: 'PNB', name: 'Punjab National Bank', ifsc_prefix: 'PUNB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Tran Date', narration: 'Particulars / Narration', ref: 'Instrument ID / Cheque No.', value_date: 'Value Date', debit: 'Withdrawal', credit: 'Deposit', balance: 'Balance' },
    detection_signals: ['PUNJAB NATIONAL BANK', 'PUNB0', 'PNB ONE']
  },
  {
    id: 'PSB', name: 'Punjab & Sind Bank', ifsc_prefix: 'PSIB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration / Description', ref: 'Cheque/Ref No.', value_date: null, debit: 'Withdrawal', credit: 'Deposit', balance: 'Balance' },
    detection_signals: ['PUNJAB & SIND', 'PSIB0']
  },
  {
    id: 'SCB', name: 'Standard Chartered Bank', ifsc_prefix: 'SCBL0',
    date_format: 'DD MMM YY',
    columns: { date: 'Date', narration: 'Description / Transaction Details', ref: 'Cheque No.', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['STANDARD CHARTERED', 'SCBL0']
  },
  {
    id: 'CANARA', name: 'Canara Bank', ifsc_prefix: 'CNRB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Tran Date', narration: 'Description', ref: 'Cheque No.', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['CANARA BANK', 'CNRB0']
  },
  {
    id: 'ICICI', name: 'ICICI Bank', ifsc_prefix: 'ICIC0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Transaction Date', narration: 'Transaction Remarks', ref: 'Cheque Number', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['ICICI BANK', 'ICIC0', 'IMOBILE']
  },
  {
    id: 'AXIS', name: 'Axis Bank', ifsc_prefix: 'UTIB0',
    date_format: 'DD-MM-YYYY',
    columns: { date: 'Tran Date', narration: 'Particulars', ref: 'Chq No', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['AXIS BANK', 'UTIB0']
  },
  {
    id: 'BOI', name: 'Bank of India', ifsc_prefix: 'BKID0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['BANK OF INDIA', 'BKID0']
  },
  {
    id: 'IB', name: 'Indian Bank', ifsc_prefix: 'IDIB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration / Description', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['INDIAN BANK', 'IDIB0', 'ALLA0']
  },
  {
    id: 'BOM', name: 'Bank of Maharashtra', ifsc_prefix: 'MAHB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['BANK OF MAHARASHTRA', 'MAHB0']
  },
  {
    id: 'YES', name: 'YES Bank', ifsc_prefix: 'YESB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Description / Narration', ref: 'Reference No.', value_date: null, debit: 'Withdrawal (Dr)', credit: 'Deposit (Cr)', balance: 'Running Balance' },
    detection_signals: ['YES BANK', 'YESB0']
  },
  {
    id: 'CBI', name: 'Central Bank of India', ifsc_prefix: 'CBIN0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['CENTRAL BANK OF INDIA', 'CBIN0']
  },
  {
    id: 'IOB', name: 'Indian Overseas Bank', ifsc_prefix: 'IOBA0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['INDIAN OVERSEAS BANK', 'IOBA0']
  },
  {
    id: 'IDBI', name: 'IDBI Bank', ifsc_prefix: 'IBKL0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Description', ref: 'Cheque No.', value_date: 'Value Date', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['IDBI BANK', 'IBKL0']
  },
  {
    id: 'FEDERAL', name: 'Federal Bank', ifsc_prefix: 'FDRL0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque/Ref No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['FEDERAL BANK', 'FDRL0']
  },
  {
    id: 'UCO', name: 'UCO Bank', ifsc_prefix: 'UCBA0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration', ref: 'Cheque No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['UCO BANK', 'UCBA0']
  },
  {
    id: 'BANDHAN', name: 'Bandhan Bank', ifsc_prefix: 'BDBL0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Narration / Particulars', ref: 'Cheque/Ref No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['BANDHAN BANK', 'BDBL0']
  },
  {
    id: 'RBL', name: 'RBL Bank', ifsc_prefix: 'RATN0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Description', ref: 'Reference No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['RBL BANK', 'RATN0', 'RATNAKAR']
  },
  {
    id: 'INDUSIND', name: 'IndusInd Bank', ifsc_prefix: 'INDB0',
    date_format: 'DD/MM/YYYY',
    columns: { date: 'Date', narration: 'Particulars / Description', ref: 'Cheque/Ref No.', value_date: null, debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    detection_signals: ['INDUSIND BANK', 'INDB0']
  },
];

// ---------------------------------------------------------------------------
// CATEGORY TAXONOMY
// ---------------------------------------------------------------------------

interface CategoryRule {
  primary: string;
  secondary: string;
  patterns: RegExp[];
  is_pnl: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  // --- INCOME ---
  { primary: 'Income', secondary: 'Salary', patterns: [/\bSALARY\b/i, /\bSAL\s/i, /\bSAL$/i, /\bPAYROLL\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Bonus', patterns: [/\bBONUS\b/i, /\bBONU\b/i, /\bPERF\s*BONUS\b/i, /\bINCENTIVE\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Freelance', patterns: [/\bFREELANCE\b/i, /\bCONSULTING\s*FEE\b/i, /\bPROFESSIONAL\s*FEE\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Interest', patterns: [/\bINT\.?\s*PAY\b/i, /\bINTEREST\s*CREDIT\b/i, /\bINT\s*CR\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Dividend', patterns: [/\bDIVIDEND\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Refund', patterns: [/\bREFUND\b/i, /\bUPIRET\b/i, /\bTRANSACTION REFUND\b/i, /\bREVERSAL\b/i, /\bREV\b/i], is_pnl: true },
  { primary: 'Income', secondary: 'Rental Income', patterns: [/\bRENT\s*CR\b/i, /\bRENT\s*RECEIVED\b/i], is_pnl: true },

  // --- HOUSING ---
  { primary: 'Housing', secondary: 'Rent', patterns: [/\bRENT\b/i, /\bHOUSE\s*RENT\b/i], is_pnl: true },
  { primary: 'Housing', secondary: 'EMI', patterns: [/\bEMI\b/i, /\bHOME\s*LOAN\b/i, /\bHL\s*EMI\b/i], is_pnl: true },
  { primary: 'Housing', secondary: 'Maintenance', patterns: [/\bMAINTENANCE\b/i, /\bSOCIETY\b/i], is_pnl: true },

  // --- TRANSPORT ---
  { primary: 'Transport', secondary: 'Fuel', patterns: [/\bFILLING\s*STATIO/i, /\bPETROL\b/i, /\bDIESEL\b/i, /\bHP\s*RETAIL\b/i, /\bBPCL\b/i, /\bIOCL\b/i, /\bINDIAN\s*OIL\b/i, /\bRELIANCE\s*BP\b/i], is_pnl: true },
  { primary: 'Transport', secondary: 'Metro/Transit', patterns: [/\bDMRC\b/i, /\bMETRO\b/i, /\bRAPIDX\b/i], is_pnl: true },
  { primary: 'Transport', secondary: 'Cab/Ride', patterns: [/\bOLA\b/i, /\bUBER\b/i, /\bRAPIDO\b/i, /\bNAMMA\s*YATRI\b/i], is_pnl: true },
  { primary: 'Transport', secondary: 'Parking', patterns: [/\bPARKIN/i, /\bPARKING\b/i], is_pnl: true },

  // --- FOOD ---
  { primary: 'Food & Dining', secondary: 'Groceries', patterns: [/\bSMART\s*BAZAAR\b/i, /\bBIG\s*BAZAAR\b/i, /\bDMART\b/i, /\bRELIANCE\s*FRESH\b/i, /\bSPENCER/i, /\bMORE\s*RETAIL\b/i, /\bNATURE.?S\s*BASKET\b/i, /\bGROCER/i], is_pnl: true },
  { primary: 'Food & Dining', secondary: 'Quick Commerce', patterns: [/\bBLINKIT\b/i, /\bZEPTO\b/i, /\bSWIGGY\s*INSTAMART\b/i, /\bBIG\s*BASKET\b/i, /\bDUNZO\b/i], is_pnl: true },
  { primary: 'Food & Dining', secondary: 'Food Delivery', patterns: [/\bSWIGGY\b/i, /\bZOMATO\b/i, /\bMEATIGO\b/i, /\bDAALCHINI\b/i], is_pnl: true },
  { primary: 'Food & Dining', secondary: 'Restaurant', patterns: [/\bHALDIRAM\b/i, /\bKHAN\s*CHACHA\b/i, /\bPUKHTAAN\b/i, /\bBLOOM\s*CAFE\b/i, /\bMAGNOLIA\s*BAKERY\b/i, /\bROYAL\s*SARDAR\b/i, /\bDOMINO/i, /\bMCDONALD/i, /\bSTARBUCKS\b/i, /\bCAFE\b/i, /\bRESTAURANT\b/i, /\bBAKERY\b/i, /\bKFC\b/i, /\bBURGER\b/i, /\bPIZZA\b/i, /\bSOUTH\s*POINT\b/i], is_pnl: true },

  // --- SHOPPING ---
  { primary: 'Shopping', secondary: 'Fashion', patterns: [/\bNIKE\b/i, /\bADIDAS\b/i, /\bZARA\b/i, /\bH&M\b/i, /\bMYNTRA\b/i, /\bAJIO\b/i, /\bBHANNE\s*RETAIL\b/i], is_pnl: true },
  { primary: 'Shopping', secondary: 'E-commerce', patterns: [/\bAMAZON\b/i, /\bFLIPKART\b/i, /\bMEESHO\b/i, /\bSNAPDEAL\b/i], is_pnl: true },
  { primary: 'Shopping', secondary: 'General', patterns: [/\bRELIANCE\s*DIGITAL\b/i, /\bCROMA\b/i, /\bVIJAY\s*SALES\b/i], is_pnl: true },

  // --- HEALTH ---
  { primary: 'Health', secondary: 'Pharmacy', patterns: [/\bMEDICIN/i, /\bPHARMA/i, /\bAPOLLO\s*PHARMACY\b/i, /\bNETMEDS\b/i, /\b1MG\b/i, /\bPHARMEASY\b/i, /\bFACEWASH\b/i], is_pnl: true },
  { primary: 'Health', secondary: 'Hospital', patterns: [/\bHOSPITAL\b/i, /\bCLINIC\b/i, /\bDIAGNOSTIC\b/i, /\bPATHOLOGY\b/i], is_pnl: true },

  // --- TELECOM ---
  { primary: 'Utilities', secondary: 'Telecom', patterns: [/\bJIO\s*RECHARGE\b/i, /\bAIRTEL\s*RECHARGE\b/i, /\bVI\s*RECHARGE\b/i, /\bBSNL\b/i, /\bRECHARGE\b/i], is_pnl: true },
  { primary: 'Utilities', secondary: 'Electricity', patterns: [/\bELECTRIC/i, /\bBSES\b/i, /\bTPDDL\b/i, /\bADANI\s*POWER\b/i, /\bMSEDCL\b/i], is_pnl: true },
  { primary: 'Utilities', secondary: 'Gas', patterns: [/\bIGL\b/i, /\bMGL\b/i, /\bPIPED\s*GAS\b/i, /\bGAIL\b/i], is_pnl: true },
  { primary: 'Utilities', secondary: 'Water', patterns: [/\bWATER\s*BILL\b/i, /\bJAL\s*BOARD\b/i], is_pnl: true },
  { primary: 'Utilities', secondary: 'Bill Pay', patterns: [/\bBILLPAY\b/i, /\bBBPS\b/i], is_pnl: true },

  // --- ENTERTAINMENT ---
  { primary: 'Entertainment', secondary: 'Movies', patterns: [/\bPVR\b/i, /\bINOX\b/i, /\bCINEPOLIS\b/i, /\bBOOKMYSHOW\b/i], is_pnl: true },
  { primary: 'Entertainment', secondary: 'Subscription', patterns: [/\bNETFLIX\b/i, /\bHOTSTAR\b/i, /\bPRIME\s*RECUR/i, /\bSPOTIFY\b/i, /\bYOUTUBE\b/i, /\bJIOCINEMA\b/i, /\bSONYLIV\b/i], is_pnl: true },

  // --- INVESTMENT ---
  { primary: 'Investment', secondary: 'SIP/MF', patterns: [/\bETMONEY\b/i, /\bGROW\b/i, /\bKUVERA\b/i, /\bCOIN\b/i, /\bSIP\b/i, /\bMUTUAL\s*FUND\b/i, /\bZERODHA\b/i, /\bGROWW\b/i], is_pnl: false },
  { primary: 'Investment', secondary: 'RD/FD', patterns: [/\bRD\s*THROUGH\b/i, /\bRECURRING\s*DEPOSIT\b/i, /\bFIXED\s*DEPOSIT\b/i, /\bFD\s*BOOKING\b/i], is_pnl: false },
  { primary: 'Investment', secondary: 'Stocks', patterns: [/\bSTOCK\b/i, /\bSHARE\b/i, /\bDEMAT\b/i, /\bCDSL\b/i, /\bNSDL\b/i], is_pnl: false },

  // --- INSURANCE ---
  { primary: 'Insurance', secondary: 'Life Insurance', patterns: [/\bLIC\b/i, /\bLIFE\s*INSURANCE\b/i, /\bHDFC\s*LIFE\b/i, /\bICICI\s*PRU/i, /\bSBI\s*LIFE\b/i, /\bMAX\s*LIFE\b/i], is_pnl: true },
  { primary: 'Insurance', secondary: 'Health Insurance', patterns: [/\bHEALTH\s*INSURANCE\b/i, /\bMEDI\s*CLAIM\b/i, /\bSTAR\s*HEALTH\b/i], is_pnl: true },
  { primary: 'Insurance', secondary: 'Vehicle Insurance', patterns: [/\bVEHICLE\s*INSURANCE\b/i, /\bMOTOR\s*INSURANCE\b/i], is_pnl: true },

  // --- EDUCATION ---
  { primary: 'Education', secondary: 'Tuition', patterns: [/\bSCHOOL\b/i, /\bTUITION\b/i, /\bCOLLEGE\b/i, /\bUNIVERSIT/i, /\bCOACHING\b/i], is_pnl: true },
  { primary: 'Education', secondary: 'EdTech', patterns: [/\bBYJUS\b/i, /\bUNACADEMY\b/i, /\bVEDANTU\b/i, /\bUPGRAD\b/i], is_pnl: true },

  // --- HOME SERVICES ---
  { primary: 'Home Services', secondary: 'Home Services', patterns: [/\bURBANCOMPANY\b/i, /\bURBAN\s*COMPANY\b/i, /\bURBAN\s*CLAP\b/i], is_pnl: true },

  // --- LEGAL/PROFESSIONAL ---
  { primary: 'Professional Services', secondary: 'Legal', patterns: [/\bVAKILSEARCH\b/i, /\bLEGAL\b/i, /\bADVOCATE\b/i, /\bNOTARY\b/i], is_pnl: true },

  // --- GOVERNMENT ---
  { primary: 'Government', secondary: 'Tax', patterns: [/\bINCOME\s*TAX\b/i, /\bGST\b/i, /\bTAX\s*PAY/i, /\bCHALLAN\b/i], is_pnl: true },

  // --- CREDIT CARD ---
  { primary: 'Credit Card', secondary: 'CC Payment', patterns: [/\bCC\s*AUTOPAY\b/i, /\bBILLPAY.*CC\b/i, /\bCC\s*PAYMENT\b/i, /\bBILLDESK\b/i, /\bBBPS.*CC\b/i, /\bHDFCSI\b/i], is_pnl: false },

  // --- LOAN ---
  { primary: 'Loan', secondary: 'EMI', patterns: [/^EMI\s/i, /\bLOAN\s*EMI\b/i, /\bPERSONAL\s*LOAN\b/i, /\bCAR\s*LOAN\b/i], is_pnl: true },
];

// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------

/** Parse Indian-formatted amount: 1,23,456.78 → 123456.78 */
function parseIndianAmount(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse date string to ISO YYYY-MM-DD */
function parseDateToISO(dateStr: string, format: string): string {
  const s = dateStr.trim();

  // DD/MM/YY
  if (format === 'DD/MM/YY') {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (m) {
      const yr = parseInt(m[3]) < 50 ? 2000 + parseInt(m[3]) : 1900 + parseInt(m[3]);
      return `${yr}-${m[2]}-${m[1]}`;
    }
  }

  // DD/MM/YYYY
  if (format === 'DD/MM/YYYY') {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  // DD-MM-YYYY
  if (format === 'DD-MM-YYYY') {
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  // DD-MMM-YYYY or DD MMM YYYY
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  const m2 = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})$/);
  if (m2) {
    const mon = months[m2[2].toUpperCase()];
    const yr = m2[3].length === 2
      ? (parseInt(m2[3]) < 50 ? '20' + m2[3] : '19' + m2[3])
      : m2[3];
    return `${yr}-${mon}-${m2[1].padStart(2, '0')}`;
  }

  return s; // fallback
}

/** Normalize narration: collapse whitespace, uppercase */
function normalizeNarration(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// STAGE 1 — PARSE
// ---------------------------------------------------------------------------

/** Detect bank from raw spreadsheet/PDF header content */
function detectBank(headerContent: string): BankSchema {
  const upper = headerContent.toUpperCase();
  for (const schema of BANK_SCHEMAS) {
    for (const signal of schema.detection_signals) {
      if (upper.includes(signal.toUpperCase())) return schema;
    }
  }
  // Fallback: try IFSC pattern
  const ifscMatch = upper.match(/([A-Z]{4}0[A-Z0-9]{6})/);
  if (ifscMatch) {
    const prefix = ifscMatch[1].substring(0, 5);
    const found = BANK_SCHEMAS.find(s => s.ifsc_prefix === prefix);
    if (found) return found;
  }
  return { ...BANK_SCHEMAS[0], id: 'UNKNOWN' as BankId, name: 'Unknown Bank', detection_signals: [] };
}

/** Extract metadata from header rows */
function extractMetadata(rows: string[][]): {
  account_number: string;
  account_holder: string;
  ifsc: string;
  period_from: string;
  period_to: string;
} {
  const allText = rows.map(r => r.join(' ')).join(' ').toUpperCase();

  // Account number
  let account_number = '';
  const acctMatch = allText.match(/ACCOUNT\s*(?:NO|NUMBER)\s*[:\s]*(\d{10,18})/i)
    || allText.match(/A\/C\s*[:\s]*(\d{10,18})/i);
  if (acctMatch) account_number = acctMatch[1];

  // Account holder — handle multi-space padding in XLS
  let account_holder = '';
  const nameMatch = allText.match(/(?:MR|MRS|MS|DR|SHRI|SMT)\s{2,}([A-Z][A-Z\s]+?)(?:\s{2,}|ADDRESS|ACCOUNT|$)/);
  if (nameMatch) {
    account_holder = nameMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    // Fallback: simpler pattern
    const nameMatch2 = allText.match(/(?:MR|MRS|MS|DR|SHRI|SMT)\s+([A-Z][A-Z\s]{3,30}?)(?:\s{2,}|$)/);
    if (nameMatch2) account_holder = nameMatch2[1].replace(/\s+/g, ' ').trim();
  }

  // IFSC
  let ifsc = '';
  const ifscMatch = allText.match(/(?:IFSC|IFS\s*CODE)\s*[:\s]*([A-Z]{4}0[A-Z0-9]{6})/);
  if (ifscMatch) ifsc = ifscMatch[1];

  // Statement period
  let period_from = '', period_to = '';
  const periodMatch = allText.match(/(?:FROM|PERIOD)\s*[:\s]*(\d{2}\/\d{2}\/\d{2,4})\s*(?:TO)\s*[:\s]*(\d{2}\/\d{2}\/\d{2,4})/);
  if (periodMatch) {
    period_from = periodMatch[1];
    period_to = periodMatch[2];
  }

  return { account_number, account_holder, ifsc, period_from, period_to };
}

/** Parse XLS/XLSX bank statement — main Stage 1 entry point */
export function stage1_parse(
  rows: (string | number | null)[][],
  fileType: 'xls' | 'xlsx' | 'csv' = 'xls'
): ParseResult {
  // Collect header text for bank detection
  const headerRows = rows.slice(0, 25);
  const headerText = headerRows.map(r => r.map(c => String(c ?? '')).join(' ')).join('\n');
  const schema = detectBank(headerText);

  // Extract metadata
  const meta = extractMetadata(headerRows.map(r => r.map(c => String(c ?? ''))));

  // Find the transaction header row
  let txnStartIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const rowStr = rows[i].map(c => String(c ?? '').toUpperCase()).join('|');
    if (rowStr.includes('DATE') && (rowStr.includes('NARRATION') || rowStr.includes('DESCRIPTION') || rowStr.includes('PARTICULAR'))) {
      txnStartIdx = i;
      break;
    }
  }

  // Parse transactions
  const transactions: RawTransaction[] = [];
  const dateRegex = /^\d{2}\/\d{2}\/\d{2,4}$|^\d{2}-\d{2}-\d{4}$|^\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4}$/;

  let idx = 0;
  for (let i = (txnStartIdx >= 0 ? txnStartIdx + 1 : 20); i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const dateVal = String(row[0] ?? '').trim();
    if (!dateRegex.test(dateVal)) continue;

    // Skip separator rows (all asterisks)
    if (dateVal.includes('***')) continue;

    const debit = parseIndianAmount(row[4]);
    const credit = parseIndianAmount(row[5]);
    const balance = parseIndianAmount(row[6]);

    if (balance === null) continue; // skip non-transaction rows

    transactions.push({
      txn_index: idx++,
      txn_date: parseDateToISO(dateVal, schema.date_format),
      value_date: parseDateToISO(String(row[3] ?? dateVal).trim(), schema.date_format),
      narration_raw: String(row[1] ?? '').trim(),
      chq_ref_no: String(row[2] ?? '').trim(),
      debit,
      credit,
      balance,
    });
  }

  // Validation
  const validation = validateTransactions(transactions);

  // Derive opening/closing balance
  const opening_balance = transactions.length > 0
    ? transactions[0].balance - (transactions[0].credit ?? 0) + (transactions[0].debit ?? 0)
    : 0;
  const closing_balance = transactions.length > 0
    ? transactions[transactions.length - 1].balance
    : 0;

  // Parse period dates
  const period_from = meta.period_from
    ? parseDateToISO(meta.period_from, schema.date_format)
    : (transactions[0]?.txn_date ?? '');
  const period_to = meta.period_to
    ? parseDateToISO(meta.period_to, schema.date_format)
    : (transactions[transactions.length - 1]?.txn_date ?? '');

  return {
    bank: schema.id,
    account_number: meta.account_number,
    account_holder: meta.account_holder,
    ifsc: meta.ifsc,
    statement_period: { from: period_from, to: period_to },
    opening_balance,
    closing_balance,
    transactions,
    validation,
  };
}

function validateTransactions(txns: RawTransaction[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Row arithmetic: balance[n] = balance[n-1] + credit[n] - debit[n]
  let row_arith_ok = true;
  for (let i = 1; i < txns.length; i++) {
    const prev = txns[i - 1].balance;
    const expected = prev + (txns[i].credit ?? 0) - (txns[i].debit ?? 0);
    const actual = txns[i].balance;
    if (Math.abs(expected - actual) > 0.02) {
      row_arith_ok = false;
      errors.push(`Row ${i}: expected balance ${expected.toFixed(2)}, got ${actual.toFixed(2)} (diff: ${(actual - expected).toFixed(2)})`);
      if (errors.length > 10) {
        errors.push('... (truncated, too many arithmetic errors)');
        break;
      }
    }
  }

  // 2. Summary reconciliation: opening + total_credits - total_debits = closing
  const totalCredits = txns.reduce((s, t) => s + (t.credit ?? 0), 0);
  const totalDebits = txns.reduce((s, t) => s + (t.debit ?? 0), 0);
  const opening = txns.length > 0
    ? txns[0].balance - (txns[0].credit ?? 0) + (txns[0].debit ?? 0)
    : 0;
  const closing = txns.length > 0 ? txns[txns.length - 1].balance : 0;
  const expectedClosing = opening + totalCredits - totalDebits;
  const summary_ok = Math.abs(expectedClosing - closing) < 0.05;
  if (!summary_ok) {
    errors.push(`Summary reconciliation: opening(${opening.toFixed(2)}) + credits(${totalCredits.toFixed(2)}) - debits(${totalDebits.toFixed(2)}) = ${expectedClosing.toFixed(2)}, but closing = ${closing.toFixed(2)}`);
  }

  // 3. Date monotonicity
  let date_mono_ok = true;
  for (let i = 1; i < txns.length; i++) {
    if (txns[i].txn_date < txns[i - 1].txn_date) {
      date_mono_ok = false;
      warnings.push(`Date reversal at row ${i}: ${txns[i].txn_date} < ${txns[i - 1].txn_date}`);
    }
  }

  return {
    passed: row_arith_ok && summary_ok,
    row_arithmetic_ok: row_arith_ok,
    summary_reconciliation_ok: summary_ok,
    date_monotonicity_ok: date_mono_ok,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// STAGE 2 — NORMALIZE
// ---------------------------------------------------------------------------

/** Detect channel from narration */
function detectChannel(narration: string): TransactionChannel {
  const n = narration.toUpperCase();
  if (n.startsWith('UPI-') || n.startsWith('UPI/')) return 'UPI';
  if (n.startsWith('UPIRET')) return 'UPI_RETURN';
  if (n.startsWith('IMPS')) return 'IMPS';
  if (n.startsWith('NEFT')) return 'NEFT';
  if (n.startsWith('RTGS')) return 'RTGS';
  if (n.startsWith('ACH') || n.startsWith('NACH')) return 'ACH';
  if (n.includes('BILLPAY')) return 'IB_BILLPAY';
  if (n.startsWith('EMI') || n.match(/^EMI\s/)) return 'EMI';
  if (n.includes('CC') && (n.includes('AUTOPAY') || n.includes('AUTO PAY'))) return 'CC_AUTOPAY';
  if (n.startsWith('RD ') || n.includes('RECURRING DEPOSIT')) return 'RD';
  if (n.includes('ATM')) return 'ATM';
  if (n.includes('POS')) return 'POS';
  if (n.includes('CHQ') || n.includes('CHEQUE')) return 'CHEQUE';
  return 'OTHER';
}

/** Extract counterparty name from narration based on channel */
function extractCounterparty(narration: string, channel: TransactionChannel): string {
  const n = narration.trim();

  switch (channel) {
    case 'UPI': {
      // UPI-NAME-VPA@BANK-IFSC-REFNO-NOTE
      const parts = n.split('-');
      if (parts.length >= 2) {
        // parts[0] = "UPI", parts[1] = counterparty name
        return cleanCounterpartyName(parts[1]);
      }
      return 'UNKNOWN';
    }
    case 'UPI_RETURN': {
      return 'UPI RETURN';
    }
    case 'IMPS': {
      // IMPS-REFNO-NAME-BANK-ACCT-TYPE
      const parts = n.split('-');
      if (parts.length >= 3) {
        return cleanCounterpartyName(parts[2]);
      }
      return 'UNKNOWN';
    }
    case 'NEFT': {
      // NEFT CR-IFSC-COMPANY-PERSON-REF NOTE
      const parts = n.split('-');
      if (parts.length >= 4) {
        return cleanCounterpartyName(parts[2]);
      }
      return 'UNKNOWN';
    }
    case 'RTGS': {
      // RTGS CR-IFSC-COMPANY-PERSON-REF
      // RTGS DR-IFSC-NAME-NOTE-REF
      const parts = n.split('-');
      if (parts.length >= 4) {
        return cleanCounterpartyName(parts[2]);
      }
      return 'UNKNOWN';
    }
    case 'ACH': {
      // ACH D- NAME-REF
      const m = n.match(/ACH\s*[DC]-\s*([^-]+)/i);
      if (m) return cleanCounterpartyName(m[1]);
      return 'UNKNOWN';
    }
    case 'IB_BILLPAY': {
      // IB BILLPAY DR-HDFCSI-CARDNO
      const m = n.match(/BILLPAY\s*DR-([^-]+)/i);
      if (m) return cleanCounterpartyName(m[1]);
      return 'BILL PAY';
    }
    case 'EMI': {
      // EMI 157265992 CHQ ...
      const m = n.match(/EMI\s*(\d+)/i);
      return m ? `EMI ${m[1]}` : 'EMI';
    }
    case 'CC_AUTOPAY': {
      // CC 000434677XXXXXX6867 AUTOPAY SI-TAD
      const m = n.match(/CC\s*([\dX]+)/i);
      return m ? `CC AUTOPAY ${m[1]}` : 'CC AUTOPAY';
    }
    case 'RD': {
      return 'RD (RECURRING DEPOSIT)';
    }
    default:
      return cleanCounterpartyName(n.substring(0, 50));
  }
}

function cleanCounterpartyName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9\s&.]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s{2,}/g, ' ');
}

/** Detect counterparty type */
function detectCounterpartyType(
  counterparty: string,
  channel: TransactionChannel,
  narration: string,
  accountHolder: string
): CounterpartyType {
  const cp = counterparty.toUpperCase();
  const nar = narration.toUpperCase();

  // Self-transfer detection
  if (accountHolder && accountHolder.trim().length > 3) {
    const holderWords = accountHolder.toUpperCase().split(/\s+/).filter(w => w.length > 2);
    if (holderWords.length >= 2 && holderWords.every(w => cp.includes(w))) {
      return 'SELF';
    }
  }

  // Employer
  if (nar.includes('SALARY') || nar.includes('SAL ') || nar.endsWith(' SAL') || nar.includes('PAYROLL')) {
    return 'EMPLOYER';
  }

  // Investment
  if (/ETMONEY|ZERODHA|GROWW|KUVERA|SIP|MUTUAL\s*FUND/i.test(cp)) return 'INVESTMENT';

  // Insurance
  if (/LIC|INSURANCE/i.test(cp)) return 'INSURANCE';

  // Bank product
  if (/EMI|CC\s*AUTOPAY|BILLPAY|RD\s*\(|RECURRING\s*DEPOSIT/i.test(cp)) return 'BANK_PRODUCT';

  // Government
  if (/DMRC|GOVERNMENT|GOV|TAX|CHALLAN/i.test(cp)) return 'GOVERNMENT';

  // Merchant vs Person heuristics
  // Merchants typically have business-like names
  const merchantSignals = /PRIVATE\s*LIMITED|PVT\s*LTD|LTD|TECHNOLOGIES|INSTAMART|RETAIL|BAZAAR|MALL|CAFE|BAKERY|RESTAURANT|FILLING\s*STATIO|RECHARGE|BLINKIT|ZEPTO|SWIGGY|AMAZON|FLIPKART|NETFLIX|HOTSTAR|URBANCOMPANY|DAALCHINI|MEATIGO|PVR|MAGNOLIA/i;
  if (merchantSignals.test(cp) || merchantSignals.test(nar)) return 'MERCHANT';

  // Persons: short names, no business keywords, UPI P2P
  if (channel === 'UPI' || channel === 'IMPS') {
    // If narration contains VPA with personal-looking handle (not business)
    if (/PAYMENT FROM PHONE|PAY BY WHATSAPP|P2AMOB|P2A/i.test(nar)) {
      // check it's not a known merchant
      if (!merchantSignals.test(cp) && !merchantSignals.test(nar)) {
        return 'PERSON';
      }
    }
  }

  return 'UNKNOWN';
}

/** Detect internal transfers between own accounts */
function detectInternalTransfers(
  txns: CanonicalTransaction[],
  accountHolder: string
): void {
  const holderParts = accountHolder.toUpperCase().split(/\s+/).filter(w => w.length > 2);

  // Guard: if we couldn't extract the holder name, skip self-transfer detection by name
  if (holderParts.length === 0) return;

  for (const txn of txns) {
    // Self-transfer if counterparty matches account holder
    if (txn.counterparty_type === 'SELF') {
      txn.is_internal_transfer = true;
      txn.is_pnl_item = false;
      txn.primary_category = 'Internal Transfer';
      txn.secondary_category = 'Self Transfer';
      continue;
    }

    // Detect round-trip transfers: debit to X of amount A + credit from X of amount A on same/adjacent day
    if (txn.debit && !txn.is_internal_transfer) {
      const matchingCredit = txns.find(t =>
        t.credit &&
        Math.abs(t.credit - (txn.debit ?? 0)) < 0.01 &&
        t.counterparty === txn.counterparty &&
        Math.abs(dateDiffDays(t.txn_date, txn.txn_date)) <= 2
      );
      if (matchingCredit) {
        // Check if the counterparty is a person (likely round-trip)
        const cpType: string = txn.counterparty_type;
        if (cpType === 'PERSON' || cpType === 'SELF' || cpType === 'UNKNOWN') {
          txn.is_internal_transfer = true;
          txn.is_pnl_item = false;
          matchingCredit.is_internal_transfer = true;
          matchingCredit.is_pnl_item = false;
          txn.primary_category = 'Internal Transfer';
          txn.secondary_category = 'Round Trip';
          matchingCredit.primary_category = 'Internal Transfer';
          matchingCredit.secondary_category = 'Round Trip';
        }
      }
    }
  }
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return (da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

/** Detect credit card payments (not P&L) */
function detectCCPayments(txns: CanonicalTransaction[]): void {
  const ccPatterns = [
    /CC\s*AUTOPAY/i,
    /BILLPAY.*CC/i,
    /BILLPAY.*HDFCSI/i,
    /CC\s*PAYMENT/i,
    /HDFC\s*CC/i,
    /BILLDESK/i,
    /BBPS.*CC/i,
  ];

  for (const txn of txns) {
    if (txn.debit && ccPatterns.some(p => p.test(txn.narration_raw))) {
      txn.is_cc_payment = true;
      txn.is_pnl_item = false;
      txn.primary_category = 'Credit Card';
      txn.secondary_category = 'CC Payment';
    }
  }
}

export function stage2_normalize(
  parseResult: ParseResult
): CanonicalTransaction[] {
  const txns: CanonicalTransaction[] = parseResult.transactions.map(raw => {
    const normalized = normalizeNarration(raw.narration_raw);
    const channel = detectChannel(raw.narration_raw);
    const counterparty = extractCounterparty(raw.narration_raw, channel);
    const counterparty_type = detectCounterpartyType(
      counterparty, channel, raw.narration_raw, parseResult.account_holder
    );

    return {
      ...raw,
      narration_normalized: normalized,
      channel,
      counterparty,
      counterparty_type,
      is_internal_transfer: false,
      is_cc_payment: false,
      primary_category: '',
      secondary_category: '',
      is_pnl_item: true,
      confidence: 0,
      needs_review: false,
      review_reason: null,
    };
  });

  // Detect internal transfers
  detectInternalTransfers(txns, parseResult.account_holder);

  // Detect CC payments
  detectCCPayments(txns);

  return txns;
}

// ---------------------------------------------------------------------------
// STAGE 3 — CATEGORIZE
// ---------------------------------------------------------------------------

export function stage3_categorize(txns: CanonicalTransaction[]): CanonicalTransaction[] {
  for (const txn of txns) {
    // Skip already classified (internal transfers, CC payments)
    if (txn.is_internal_transfer || txn.is_cc_payment) {
      txn.confidence = 1.0;
      continue;
    }

    let matched = false;
    let bestConfidence = 0;

    for (const rule of CATEGORY_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(txn.narration_raw) || pattern.test(txn.counterparty)) {
          // Calculate confidence based on match quality
          let confidence = 0.85;

          // Boost confidence for explicit keyword matches
          if (/SALARY|EMI|RENT|INSURANCE|RECHARGE|SIP/i.test(txn.narration_raw)) {
            confidence = 0.95;
          }

          // Boost for known merchant names
          if (/BLINKIT|ZEPTO|SWIGGY|AMAZON|FLIPKART|PVR|NIKE|DMRC|URBANCOMPANY|ETMONEY|LIC/i.test(txn.counterparty)) {
            confidence = 0.95;
          }

          if (confidence > bestConfidence) {
            txn.primary_category = rule.primary;
            txn.secondary_category = rule.secondary;
            txn.is_pnl_item = rule.is_pnl;
            txn.confidence = confidence;
            bestConfidence = confidence;
            matched = true;
          }
        }
      }
    }

    if (!matched) {
      // Employer detection: large credit via NEFT/RTGS from company-like counterparty
      if (txn.credit && txn.credit > 20000
        && (txn.channel === 'NEFT' || txn.channel === 'RTGS')
        && /PRIVATE\s*LIMITED|PVT\s*LTD|TECHNOLOG|CONSULT|ENTERPRISE|CORPORATION|COMPANY/i.test(txn.narration_raw)
      ) {
        txn.primary_category = 'Income';
        txn.secondary_category = 'Salary';
        txn.confidence = /SALARY|SAL\b/i.test(txn.narration_raw) ? 0.95 : 0.80;
        txn.is_pnl_item = true;
        txn.counterparty_type = 'EMPLOYER';
        matched = true;
      }
    }

    if (!matched) {
      // Fallback: classify by counterparty type
      if (txn.counterparty_type === 'PERSON') {
        txn.primary_category = 'Transfers';
        txn.secondary_category = 'Person-to-Person';
        txn.confidence = 0.5;
        txn.is_pnl_item = true;
      } else if (txn.counterparty_type === 'EMPLOYER') {
        txn.primary_category = 'Income';
        txn.secondary_category = 'Salary';
        txn.confidence = 0.85;
        txn.is_pnl_item = true;
      } else {
        txn.primary_category = 'Uncategorized';
        txn.secondary_category = 'Unknown';
        txn.confidence = 0.3;
        txn.is_pnl_item = true;
      }
    }

    // Flag for review
    if (txn.confidence < 0.75) {
      txn.needs_review = true;
      txn.review_reason = `Low confidence (${(txn.confidence * 100).toFixed(0)}%) — unable to auto-classify`;
    }

    // Also flag high-value low-confidence
    const amount = txn.debit ?? txn.credit ?? 0;
    if (amount > 50000 && txn.confidence < 0.85) {
      txn.needs_review = true;
      txn.review_reason = `High-value transaction (₹${amount.toLocaleString('en-IN')}) with moderate confidence`;
    }
  }

  return txns;
}

// ---------------------------------------------------------------------------
// STAGE 4 — ANALYZE
// ---------------------------------------------------------------------------

export function stage4_analyze(txns: CanonicalTransaction[]): AnalysisResult {
  // --- Running aggregates ---
  const pnlTxns = txns.filter(t => !t.is_internal_transfer && !t.is_cc_payment);
  const total_inflow = pnlTxns.reduce((s, t) => s + (t.credit ?? 0), 0);
  const total_outflow = pnlTxns.reduce((s, t) => s + (t.debit ?? 0), 0);
  const net_cashflow = total_inflow - total_outflow;

  // --- Inflow/outflow by channel ---
  const inflow_by_channel: Record<string, number> = {};
  const outflow_by_channel: Record<string, number> = {};
  for (const t of pnlTxns) {
    if (t.credit) {
      inflow_by_channel[t.channel] = (inflow_by_channel[t.channel] ?? 0) + t.credit;
    }
    if (t.debit) {
      outflow_by_channel[t.channel] = (outflow_by_channel[t.channel] ?? 0) + t.debit;
    }
  }

  // --- Top counterparties ---
  const cpMap = new Map<string, { total: number; count: number }>();
  for (const t of pnlTxns) {
    const amount = t.debit ?? t.credit ?? 0;
    const existing = cpMap.get(t.counterparty) ?? { total: 0, count: 0 };
    existing.total += amount;
    existing.count += 1;
    cpMap.set(t.counterparty, existing);
  }
  const top_counterparties_by_volume = Array.from(cpMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // --- Monthly summary ---
  const monthMap = new Map<string, MonthlySummary>();
  for (const t of pnlTxns) {
    const month = t.txn_date.substring(0, 7); // YYYY-MM
    const existing = monthMap.get(month) ?? { month, inflow: 0, outflow: 0, net: 0, txn_count: 0 };
    existing.inflow += t.credit ?? 0;
    existing.outflow += t.debit ?? 0;
    existing.net = existing.inflow - existing.outflow;
    existing.txn_count += 1;
    monthMap.set(month, existing);
  }
  const monthly_summary = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // --- Recurring payment detection (≥3 same counterparty, similar amount, monthly) ---
  const recurring_payments: RecurringPayment[] = [];
  const cpTxnMap = new Map<string, CanonicalTransaction[]>();
  for (const t of pnlTxns) {
    if (!t.debit) continue;
    const key = t.counterparty;
    const arr = cpTxnMap.get(key) ?? [];
    arr.push(t);
    cpTxnMap.set(key, arr);
  }
  for (const [cp, cpTxns] of cpTxnMap) {
    if (cpTxns.length < 3) continue;
    // Check if amounts are similar (within 5%)
    const amounts = cpTxns.map(t => t.debit!);
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const allSimilar = amounts.every(a => Math.abs(a - avg) / avg < 0.05);
    if (allSimilar) {
      recurring_payments.push({
        counterparty: cp,
        amount: avg,
        frequency: 'monthly',
        occurrences: cpTxns.length,
        dates: cpTxns.map(t => t.txn_date),
        category: cpTxns[0].primary_category,
      });
    }
  }

  // --- Salary credits ---
  const salary_credits: SalaryCredit[] = txns
    .filter(t => t.credit && t.primary_category === 'Income' && t.secondary_category === 'Salary')
    .map(t => ({
      employer: t.counterparty,
      amount: t.credit!,
      date: t.txn_date,
      auto_confirmed: t.confidence >= 0.9,
    }));

  // Also detect salary-like credits from NEFT/RTGS with company names
  for (const t of txns) {
    if (t.credit && t.credit > 50000 && (t.channel === 'NEFT' || t.channel === 'RTGS')) {
      if (t.counterparty_type === 'EMPLOYER' || /PRIVATE\s*LIMITED|PVT\s*LTD|TECHNOLOG/i.test(t.narration_raw)) {
        if (!salary_credits.find(s => s.date === t.txn_date && s.amount === t.credit)) {
          salary_credits.push({
            employer: t.counterparty,
            amount: t.credit,
            date: t.txn_date,
            auto_confirmed: /SALARY|SAL/i.test(t.narration_raw),
          });
        }
      }
    }
  }

  // --- EMI outflows ---
  const emi_outflows: EmiOutflow[] = txns
    .filter(t => t.debit && (t.channel === 'EMI' || t.secondary_category === 'EMI'))
    .map(t => {
      const emiMatch = t.narration_raw.match(/EMI\s*(\d+)/i);
      return {
        description: t.narration_raw,
        amount: t.debit!,
        date: t.txn_date,
        emi_id: emiMatch ? emiMatch[1] : null,
      };
    });

  // --- Investment outflows ---
  const investmentTxns = pnlTxns.filter(t => t.debit && t.primary_category === 'Investment');
  const invMap = new Map<string, { total: number; count: number }>();
  for (const t of investmentTxns) {
    const ex = invMap.get(t.counterparty) ?? { total: 0, count: 0 };
    ex.total += t.debit!;
    ex.count += 1;
    invMap.set(t.counterparty, ex);
  }
  const investment_outflows = Array.from(invMap.entries())
    .map(([name, v]) => ({ name, ...v }));

  // --- Insurance premiums ---
  const insuranceTxns = pnlTxns.filter(t => t.debit && t.primary_category === 'Insurance');
  const insurance_premiums = insuranceTxns.map(t => ({
    name: t.counterparty,
    amount: t.debit!,
  }));

  return {
    total_inflow,
    total_outflow,
    net_cashflow,
    inflow_by_channel,
    outflow_by_channel,
    top_counterparties_by_volume,
    monthly_summary,
    recurring_payments,
    salary_credits,
    emi_outflows,
    investment_outflows,
    insurance_premiums,
  };
}

// ---------------------------------------------------------------------------
// STAGE 5 — REPORT
// ---------------------------------------------------------------------------

function detectAnomalies(txns: CanonicalTransaction[], analysis: AnalysisResult): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Large transactions (> ₹1,00,000)
  for (const t of txns) {
    const amt = t.debit ?? t.credit ?? 0;
    if (amt > 100000 && !t.is_internal_transfer) {
      anomalies.push({
        type: 'large_transaction',
        description: `₹${amt.toLocaleString('en-IN')} ${t.debit ? 'debit' : 'credit'} — ${t.counterparty} on ${t.txn_date}`,
        severity: amt > 500000 ? 'critical' : 'warning',
        txn_indices: [t.txn_index],
      });
    }
  }

  // Spending spikes: daily spend > 3x daily average
  const daySpend = new Map<string, number>();
  for (const t of txns) {
    if (t.debit && !t.is_internal_transfer && !t.is_cc_payment) {
      daySpend.set(t.txn_date, (daySpend.get(t.txn_date) ?? 0) + t.debit);
    }
  }
  if (daySpend.size > 0) {
    const dailyAvg = Array.from(daySpend.values()).reduce((s, v) => s + v, 0) / daySpend.size;
    for (const [date, spend] of daySpend) {
      if (spend > dailyAvg * 3 && spend > 10000) {
        const dayTxns = txns.filter(t => t.txn_date === date && t.debit && !t.is_internal_transfer);
        anomalies.push({
          type: 'spending_spike',
          description: `Spending spike on ${date}: ₹${spend.toLocaleString('en-IN')} (${(spend / dailyAvg).toFixed(1)}x daily average)`,
          severity: 'info',
          txn_indices: dayTxns.map(t => t.txn_index),
        });
      }
    }
  }

  return anomalies;
}

export function stage5_report(
  parseResult: ParseResult,
  txns: CanonicalTransaction[],
  analysis: AnalysisResult
): PipelineReport {
  const anomalies = detectAnomalies(txns, analysis);

  return {
    parse_status: parseResult.validation.passed ? 'success' : 'partial',
    bank: parseResult.bank,
    statement_period: parseResult.statement_period,
    total_transactions: txns.length,
    categorization_summary: {
      auto_classified: txns.filter(t => !t.needs_review).length,
      needs_review: txns.filter(t => t.needs_review).length,
      internal_transfers: txns.filter(t => t.is_internal_transfer).length,
      cc_payments: txns.filter(t => t.is_cc_payment).length,
    },
    session_totals: {
      total_inflow: analysis.total_inflow,
      total_outflow: analysis.total_outflow,
      net_cashflow: analysis.net_cashflow,
    },
    anomalies,
    analysis,
    transactions: txns,
  };
}

// ---------------------------------------------------------------------------
// PIPELINE ORCHESTRATOR — runs all 5 stages
// ---------------------------------------------------------------------------

export function runPipeline(
  rows: (string | number | null)[][],
  fileType: 'xls' | 'xlsx' | 'csv' = 'xls'
): PipelineReport {
  // STAGE 1: Parse
  const parseResult = stage1_parse(rows, fileType);

  // CHECKPOINT: halt if validation fails critically
  if (!parseResult.validation.row_arithmetic_ok && parseResult.transactions.length === 0) {
    return {
      parse_status: 'failed',
      bank: parseResult.bank,
      statement_period: parseResult.statement_period,
      total_transactions: 0,
      categorization_summary: { auto_classified: 0, needs_review: 0, internal_transfers: 0, cc_payments: 0 },
      session_totals: { total_inflow: 0, total_outflow: 0, net_cashflow: 0 },
      anomalies: [],
      analysis: {
        total_inflow: 0, total_outflow: 0, net_cashflow: 0,
        inflow_by_channel: {}, outflow_by_channel: {},
        top_counterparties_by_volume: [], monthly_summary: [],
        recurring_payments: [], salary_credits: [], emi_outflows: [],
        investment_outflows: [], insurance_premiums: [],
      },
      transactions: [],
    };
  }

  // STAGE 2: Normalize
  const normalizedTxns = stage2_normalize(parseResult);

  // STAGE 3: Categorize
  const categorizedTxns = stage3_categorize(normalizedTxns);

  // STAGE 4: Analyze
  const analysis = stage4_analyze(categorizedTxns);

  // STAGE 5: Report
  return stage5_report(parseResult, categorizedTxns, analysis);
}
