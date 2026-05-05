// ============================================================================
// ArthVo Transaction Intelligence Engine
// ============================================================================
//
// Philosophy: A CA doesn't pattern-match. They UNDERSTAND.
//
// "UPI-NIKITA SHARMA-NIKITAS820@OKAXIS-KKBK0005289-389723639648-MEDICINES FACEWASH"
//   → A human reads this and knows: wife/partner bought medicines and facewash.
//   → Category: Health/Personal Care. Counterparty: Nikita Sharma (family).
//   → The NOTE at the end ("MEDICINES FACEWASH") overrides who sent it.
//
// "UPI-KAMALESH-POOJAKUMARI828567@OKICICI-CNRB0000033-676367643923-PAYMENT FROM PHONE"
//   → Small recurring amount to a person with a personal VPA → domestic help.
//   → Flag for user: "Is Kamalesh your domestic help / regular vendor?"
//
// "IMPS-609911133134-NIKITA SHARMA-INDB-XXXXXXXX2644-P2AMOB"
//   → P2A Mobile transfer to same person as UPI. Consolidate identity.
//
// This engine works in 4 layers:
//   1. DISSECT — Break narration into structured parts (channel, name, VPA, bank, note)
//   2. IDENTIFY — Who is this? Merge identities across transactions.
//   3. UNDERSTAND — What does this transaction MEAN? Use context clues.
//   4. VERDICT — Confident classification, or honest "I don't know, ask the user."
// ============================================================================

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface DissectedTransaction {
  /** Original narration */
  raw: string;

  /** Payment channel */
  channel: Channel;

  /** Extracted counterparty name (cleaned) */
  counterparty_name: string;

  /** VPA / account identifier if present */
  identifier: string;

  /** Bank of counterparty (from IFSC or VPA suffix) */
  counterparty_bank: string;

  /** UTR / reference number */
  reference: string;

  /** The NOTE — the part after the last reference, often reveals purpose */
  note: string;

  /** Amount */
  amount: number;

  /** Direction */
  direction: 'debit' | 'credit';

  /** Date (ISO) */
  date: string;

  /** Running balance after this transaction */
  balance: number;
}

export interface UnderstoodTransaction extends DissectedTransaction {
  /** What we think this IS */
  meaning: TransactionMeaning;

  /** Who this person/entity really is in the user's life */
  identity: IdentityProfile;

  /** Our confidence: 'certain' = auto-classify, 'likely' = classify with note, 'unclear' = ask user */
  clarity: 'certain' | 'likely' | 'unclear';

  /** If clarity != 'certain', why we're unsure */
  uncertainty_reason: string | null;

  /** Human-readable one-line explanation */
  explanation: string;

  /** Does this affect P&L? (self-transfers, CC payments, investment moves = NO) */
  affects_pnl: boolean;

  /** Category assignment */
  category: { primary: string; secondary: string };

  /** Tags for analytics */
  tags: string[];
}

export interface TransactionMeaning {
  type:
    | 'salary'           // Regular employment income
    | 'bonus'            // One-time employment bonus
    | 'freelance'        // Freelance/consulting income
    | 'interest'         // Bank interest, FD interest
    | 'cashback'         // Rewards, cashback credits
    | 'refund'           // Transaction reversal
    | 'self_transfer'    // Between own accounts
    | 'family_transfer'  // Money to/from family (spouse, parent)
    | 'domestic_help'    // Maid, cook, driver, guard
    | 'rent'             // Housing rent
    | 'emi'              // Loan EMI (with loan type)
    | 'cc_payment'       // Credit card bill payment
    | 'insurance'        // Insurance premium
    | 'investment'       // SIP, stocks, MF, NPS, PPF
    | 'tax'              // Income tax, advance tax, GST
    | 'utility'          // Electricity, water, gas, broadband, telecom
    | 'grocery'          // Grocery stores, supermarkets, quick commerce
    | 'food'             // Restaurants, food delivery, cafes
    | 'shopping'         // E-commerce, retail, fashion
    | 'transport'        // Fuel, cab, metro, parking, flights, trains
    | 'health'           // Hospital, pharmacy, doctor, lab tests
    | 'education'        // School, coaching, education loan
    | 'entertainment'    // Movies, subscriptions, gaming
    | 'travel'           // Hotels, flights, tour packages
    | 'home_services'    // Urban Company, repair, cleaning
    | 'fitness'          // Gym, sports, wellness
    | 'gift'             // Gifts, donations
    | 'atm'              // Cash withdrawal
    | 'vendor_payment'   // Local vendor, unclear P2P
    | 'unknown';         // Truly can't tell
  /** Sub-type for specificity */
  subtype: string;
  /** Loan ID if EMI */
  loan_id: string | null;
  /** Loan type if EMI */
  loan_type: string | null;
}

export interface IdentityProfile {
  /** Canonical name (merged across transactions) */
  name: string;
  /** What this person/entity is to the user */
  relationship:
    | 'self'
    | 'spouse_partner'
    | 'parent'
    | 'family'
    | 'domestic_help'
    | 'employer'
    | 'freelance_client'
    | 'landlord'
    | 'merchant'
    | 'bank_product'
    | 'government'
    | 'investment_platform'
    | 'insurance_provider'
    | 'unknown_person'
    | 'unknown_merchant';
  /** All VPAs / account numbers seen for this entity */
  known_identifiers: string[];
  /** Number of transactions with this entity */
  transaction_count: number;
  /** Total money flow */
  total_amount: number;
}

type Channel =
  | 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'NACH' | 'ACH'
  | 'EMI' | 'CC_AUTOPAY' | 'ATM' | 'IB_BILLPAY'
  | 'RD' | 'FD' | 'INTEREST' | 'CASHBACK' | 'TAX'
  | 'UPI_RETURN' | 'OTHER';


// ---------------------------------------------------------------------------
// LAYER 1: DISSECT — Break narration into structured parts
// ---------------------------------------------------------------------------

export function dissect(
  narration: string,
  debit: number | null,
  credit: number | null,
  balance: number,
  date: string,
  ref?: string
): DissectedTransaction {
  const raw = narration.trim();
  const upper = raw.toUpperCase();
  const amount = debit ?? credit ?? 0;
  const direction: 'debit' | 'credit' = debit && debit > 0 ? 'debit' : 'credit';

  // Detect channel
  const channel = detectChannel(upper);

  // Parse based on channel
  let counterparty_name = '';
  let identifier = '';
  let counterparty_bank = '';
  let reference = ref || '';
  let note = '';

  if (channel === 'UPI') {
    // UPI-NAME-VPA@BANK-IFSC-UTRNO-NOTE
    // Some have extra segments. Split on '-' but be careful with names containing '-'
    const parts = raw.replace(/^UPI-/i, '').split('-');
    if (parts.length >= 1) counterparty_name = parts[0].trim();
    if (parts.length >= 2) identifier = parts[1].trim(); // VPA
    if (parts.length >= 3) counterparty_bank = extractBankFromIFSC(parts[2].trim());
    if (parts.length >= 4) reference = reference || parts[3].trim();
    // Everything after the UTR/reference is the NOTE — this is gold
    if (parts.length >= 5) note = parts.slice(4).join('-').trim();

    // Extract bank from VPA suffix too: @OKAXIS → Axis, @OKSBI → SBI
    if (!counterparty_bank && identifier.includes('@')) {
      counterparty_bank = extractBankFromVPA(identifier);
    }
  }
  else if (channel === 'IMPS') {
    // IMPS-REFNO-NAME-BANKCODE-ACCTNO-TYPE
    const parts = raw.replace(/^IMPS-/i, '').split('-');
    if (parts.length >= 1) reference = reference || parts[0].trim();
    if (parts.length >= 2) counterparty_name = parts[1].trim();
    if (parts.length >= 3) counterparty_bank = parts[2].trim();
    if (parts.length >= 4) identifier = parts[3].trim(); // partial account
    if (parts.length >= 5) note = parts[4].trim(); // P2AMOB, IMPS TRANSACTION etc.
  }
  else if (channel === 'NEFT' || channel === 'RTGS') {
    // NEFT-DESCRIPTION or NEFT CR-IFSC-COMPANY-PERSON-REF NOTE
    const cleaned = raw.replace(/^(NEFT|RTGS)\s*(CR|DR)?-?/i, '').trim();
    const parts = cleaned.split('-');

    // Check if first part is IFSC (4 alpha + 0 + 6 alphanum)
    if (parts.length >= 3 && /^[A-Z]{4}0/.test(parts[0].trim().toUpperCase())) {
      counterparty_bank = extractBankFromIFSC(parts[0].trim());
      counterparty_name = parts[1].trim();
      note = parts.slice(2).join('-').trim();
    } else {
      // Freeform: NEFT-TECHVISTA SOLUTIONS-SALARY SEP 20
      // or NEFT-RENT PAYMENT-LAKSHMI NARAYANAN
      // or NEFT-SELF TRANSFER FROM ICICI A/C XX45
      counterparty_name = parts[0].trim();
      note = parts.slice(1).join('-').trim();
    }
  }
  else if (channel === 'NACH' || channel === 'ACH') {
    // NACH-ENTITY-DETAIL or ACH D- ENTITY-REF
    const cleaned = raw.replace(/^(NACH|ACH)\s*[DC]?-?\s*/i, '').trim();
    const parts = cleaned.split('-');
    counterparty_name = parts[0].trim();
    note = parts.slice(1).join('-').trim();
  }
  else if (channel === 'EMI') {
    // EMI-LOAN TYPE A/C XXXXXX-MONTH YEAR or EMI 157265992 CHQ...
    const cleaned = raw.replace(/^EMI-?/i, '').trim();
    counterparty_name = 'BANK EMI';
    note = cleaned;
  }
  else if (channel === 'CC_AUTOPAY') {
    // CC AUTOPAY-BANK CARD XXXX1234-MONTH
    counterparty_name = 'CREDIT CARD';
    note = raw.replace(/^CC\s*AUTOPAY-?/i, '').trim();
  }
  else if (channel === 'ATM') {
    counterparty_name = 'ATM WITHDRAWAL';
    note = raw.replace(/^ATM-?WDL-?/i, '').trim();
  }
  else if (channel === 'INTEREST') {
    counterparty_name = 'BANK INTEREST';
    note = raw;
  }
  else if (channel === 'CASHBACK') {
    counterparty_name = 'CASHBACK';
    note = raw;
  }
  else if (channel === 'TAX') {
    counterparty_name = 'INCOME TAX';
    note = raw;
  }
  else {
    counterparty_name = raw.substring(0, 50);
    note = raw;
  }

  // Clean counterparty name
  counterparty_name = cleanName(counterparty_name);

  return {
    raw,
    channel,
    counterparty_name,
    identifier,
    counterparty_bank,
    reference,
    note,
    amount,
    direction,
    date,
    balance,
  };
}

function detectChannel(upper: string): Channel {
  if (upper.startsWith('UPIRET')) return 'UPI_RETURN';
  if (upper.startsWith('UPI-') || upper.startsWith('UPI/')) return 'UPI';
  if (upper.startsWith('IMPS')) return 'IMPS';
  if (upper.startsWith('NEFT')) return 'NEFT';
  if (upper.startsWith('RTGS')) return 'RTGS';
  if (upper.startsWith('NACH') || upper.startsWith('ACH')) return 'NACH';
  if (upper.startsWith('EMI') || /^EMI[\s-]/.test(upper)) return 'EMI';
  if (upper.startsWith('CC ') && upper.includes('AUTOPAY')) return 'CC_AUTOPAY';
  if (upper.includes('ATM') && upper.includes('WDL')) return 'ATM';
  if (upper.includes('BILLPAY')) return 'IB_BILLPAY';
  if (upper.startsWith('RD ') || upper.includes('RECURRING DEPOSIT')) return 'RD';
  if (upper.startsWith('FD ') || upper.includes('FIXED DEPOSIT')) return 'FD';
  if (upper.includes('INTEREST CREDIT') || upper.includes('INT/SA/') || upper.includes('INT/FD/')) return 'INTEREST';
  if (upper.includes('CASHBACK') || upper.includes('REWARD')) return 'CASHBACK';
  if (upper.includes('TAX PAYMENT') || upper.includes('ADVANCE TAX') || upper.includes('CHALLAN')) return 'TAX';
  return 'OTHER';
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9\s&.'()]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s{2,}/g, ' ')
    // Remove common suffixes that add no info
    .replace(/\s*PAYMENT FROM PHONE?\s*$/i, '')
    .replace(/\s*PAY BY WHATSAPP\s*$/i, '')
    .replace(/\s*P2AMOB\s*$/i, '')
    .replace(/\s*UPIINTENT\s*$/i, '')
    .replace(/\s*IMPS TRANSACTION\s*$/i, '')
    .replace(/\s*NETBANK.*$/i, '')
    .trim();
}

/** Extract bank name from IFSC prefix */
function extractBankFromIFSC(ifsc: string): string {
  const prefix = ifsc.toUpperCase().substring(0, 4);
  const map: Record<string, string> = {
    HDFC: 'HDFC', SBIN: 'SBI', ICIC: 'ICICI', UTIB: 'Axis',
    KKBK: 'Kotak', CNRB: 'Canara', BARB: 'BOB', PUNB: 'PNB',
    INDB: 'IndusInd', IOBA: 'IOB', YESB: 'YES', BKID: 'BOI',
    UBIN: 'Union', FDRL: 'Federal', IDFB: 'IDFC', MAHB: 'BOM',
    ESFB: 'Equitas', RATN: 'RBL', PSIB: 'PSB', AIRP: 'Airtel Payments',
  };
  return map[prefix] || ifsc;
}

/** Extract bank name from VPA suffix */
function extractBankFromVPA(vpa: string): string {
  const suffix = vpa.split('@')[1]?.toLowerCase() || '';
  const map: Record<string, string> = {
    oksbi: 'SBI', okaxis: 'Axis', okhdfcbank: 'HDFC', okicici: 'ICICI',
    ybl: 'PhonePe/YES', axl: 'PhonePe/Axis', ptyes: 'Paytm', paytm: 'Paytm',
    hdfcbank: 'HDFC', apl: 'Amazon Pay', ibl: 'ICICI', 'kotak': 'Kotak',
    ptsbi: 'Paytm/SBI', ptaxis: 'Paytm/Axis', naviaxis: 'Navi',
  };
  // Handle Paytm QR patterns
  if (suffix.startsWith('ptys') || suffix.startsWith('ptmupi')) return 'Paytm';
  if (suffix.startsWith('pty')) return 'Paytm';
  if (suffix.startsWith('mchupi')) return 'Paytm';
  return map[suffix] || suffix;
}


// ---------------------------------------------------------------------------
// LAYER 2: IDENTIFY — Who is this person? Merge identities across txns.
// ---------------------------------------------------------------------------

export interface IdentityMap {
  [canonicalName: string]: IdentityProfile;
}

/**
 * Build identity profiles across all transactions.
 * Groups the same person across UPI, IMPS, NEFT by name similarity.
 */
export function buildIdentityMap(
  dissected: DissectedTransaction[],
  accountHolderName: string
): IdentityMap {
  const identities: IdentityMap = {};
  const holderWords = accountHolderName.toUpperCase().split(/\s+/).filter(w => w.length > 2);

  for (const txn of dissected) {
    const name = txn.counterparty_name;
    if (!name || name.length < 2) continue;

    // Find or create canonical identity
    const canonical = findCanonical(name, identities);
    if (!identities[canonical]) {
      identities[canonical] = {
        name: canonical,
        relationship: 'unknown_person',
        known_identifiers: [],
        transaction_count: 0,
        total_amount: 0,
      };
    }

    const profile = identities[canonical];
    profile.transaction_count += 1;
    profile.total_amount += txn.amount;
    if (txn.identifier && !profile.known_identifiers.includes(txn.identifier)) {
      profile.known_identifiers.push(txn.identifier);
    }
  }

  // Now classify relationships
  for (const [name, profile] of Object.entries(identities)) {
    profile.relationship = inferRelationship(name, profile, holderWords, dissected);
  }

  return identities;
}

/** Find the canonical name for a counterparty, merging similar names */
function findCanonical(name: string, existing: IdentityMap): string {
  const upper = name.toUpperCase().trim();

  // Exact match
  if (existing[upper]) return upper;

  // Fuzzy match: compare first+last name tokens
  const tokens = upper.split(/\s+/);
  for (const [canonical] of Object.entries(existing)) {
    const canonTokens = canonical.split(/\s+/);
    // Match if first name matches and last name matches (or one is subset of other)
    if (tokens.length >= 1 && canonTokens.length >= 1) {
      if (tokens[0] === canonTokens[0] && (
        tokens.length === 1 || canonTokens.length === 1 ||
        tokens[tokens.length - 1] === canonTokens[canonTokens.length - 1]
      )) {
        return canonical;
      }
    }
  }

  return upper;
}

/** Infer relationship based on transaction patterns */
function inferRelationship(
  name: string,
  profile: IdentityProfile,
  holderWords: string[],
  allTxns: DissectedTransaction[]
): IdentityProfile['relationship'] {
  const upper = name.toUpperCase();

  // Self-transfer: name matches account holder
  if (holderWords.length >= 2 && holderWords.every(w => upper.includes(w))) {
    return 'self';
  }

  // Bank products
  if (/^(BANK EMI|CREDIT CARD|BANK INTEREST|ATM WITHDRAWAL|RD|CASHBACK|CC AUTOPAY)/.test(upper)) {
    return 'bank_product';
  }
  if (/^INCOME TAX/.test(upper)) return 'government';

  // Known merchants/platforms
  if (isMerchant(upper)) return 'merchant';

  // Investment platforms
  if (/ETMONEY|ZERODHA|GROWW|KUVERA|COIN|MUTUAL FUND|PPF|NPS/.test(upper)) return 'investment_platform';

  // Insurance
  if (/^LIC|INSURANCE|STAR HEALTH/.test(upper)) return 'insurance_provider';

  // Employer detection: NEFT/RTGS credits with SALARY/BONUS keywords
  const entityTxns = allTxns.filter(t => cleanName(t.counterparty_name) === upper);
  const hasSalaryKeyword = entityTxns.some(t =>
    /SALARY|SAL\b|PAYROLL|BONUS|PERF BONUS/i.test(t.raw)
  );
  const hasLargeCredits = entityTxns.some(t => t.direction === 'credit' && t.amount > 50000);
  const isCompanyName = /PRIVATE\s*LIMITED|PVT\s*LTD|TECHNOLOGIES|SOLUTIONS|MEDIA|STUDIO|DIGITAL|TECH\b/i.test(upper);

  if (hasSalaryKeyword) return 'employer';
  if (isCompanyName && hasLargeCredits) return 'freelance_client';

  // Landlord: recurring same-amount NEFT debits with RENT keyword
  if (/RENT/.test(entityTxns.map(t => t.raw + t.note).join(' ').toUpperCase())) return 'landlord';

  // Spouse/partner heuristics:
  // - High frequency (5+ txns/month)
  // - Mix of debits AND credits
  // - Notes contain household keywords
  // - Large round-trip transfers
  const hasDebits = entityTxns.some(t => t.direction === 'debit');
  const hasCredits = entityTxns.some(t => t.direction === 'credit');
  const hasHouseholdNotes = entityTxns.some(t =>
    /HOUSEHOLD|GROCERY|MEDICINES|METRO|TOWARDS CC|FACEWASH/i.test(t.note)
  );
  if (profile.transaction_count >= 5 && hasDebits && (hasCredits || hasHouseholdNotes)) {
    return 'spouse_partner';
  }

  // Parent: "MOM", "DAD", "MOTHER", "FATHER" in narration or note
  if (/\bMOM\b|\bDAD\b|\bMOTHER\b|\bFATHER\b|\bMAA\b|\bPAPA\b/i.test(
    entityTxns.map(t => t.raw).join(' ')
  )) {
    return 'parent';
  }

  // Domestic help: recurring small debits (< ₹5000) to same person, P2P channel
  const isSmallRecurring = profile.transaction_count >= 2
    && entityTxns.every(t => t.direction === 'debit' && t.amount < 5000)
    && entityTxns.every(t => t.channel === 'UPI' || t.channel === 'IMPS');
  if (isSmallRecurring) return 'domestic_help';

  // Unknown person (P2P payments that don't match any pattern)
  if (entityTxns.every(t => t.channel === 'UPI' || t.channel === 'IMPS')) {
    return 'unknown_person';
  }

  return 'unknown_merchant';
}

function isMerchant(name: string): boolean {
  const merchantPatterns = [
    /SWIGGY|ZOMATO|BLINKIT|ZEPTO|BIGBASKET|DUNZO|MEATIGO|DAALCHINI/,
    /AMAZON|FLIPKART|MYNTRA|MEESHO|AJIO|LENSKART|DECATHLON/,
    /UBER|OLA|RAPIDO|DMRC|IRCTC|MAKEMYTRIP|CLEARTRIP/,
    /PVR|INOX|BOOKMYSHOW|NETFLIX|HOTSTAR|SPOTIFY/,
    /URBANCOMPANY|URBAN COMPANY|PRACTO|APOLLO|1MG|TATA 1MG/,
    /NIKE|ADIDAS|ZARA|CULT\.?FIT/,
    /JIO|AIRTEL|BESCOM|BWSSB|TPDDL|BSES/,
    /HALDIRAM|KHAN CHACHA|PUKHTAAN|BLOOM CAFE|MAGNOLIA|ROYAL SARDAR|SOUTH POINT/,
    /SMART BAZAAR|D.?MART|RELIANCE FRESH|SPAR|MORE RETAIL/,
    /FILLING STATIO|HP FUEL|BPCL|IOCL|INDIAN OIL/,
    /FERNS N PETALS|AMAZON PAY|PHONPE|CRED/,
    /VAKILSEARCH|NSDL|HDFC REWARDS|BANANA\s*CLUB/,
    /SAHARA MALL|AMBIENCE MALL|PARKING/,
  ];
  return merchantPatterns.some(p => p.test(name));
}


// ---------------------------------------------------------------------------
// LAYER 3: UNDERSTAND — What does this transaction MEAN?
// ---------------------------------------------------------------------------

export function understand(
  txn: DissectedTransaction,
  identity: IdentityProfile,
  accountHolderName: string
): UnderstoodTransaction {
  // Start with defaults
  let meaning: TransactionMeaning = {
    type: 'unknown', subtype: '', loan_id: null, loan_type: null
  };
  let clarity: UnderstoodTransaction['clarity'] = 'unclear';
  let explanation = '';
  let affects_pnl = true;
  let category = { primary: 'Uncategorized', secondary: 'Unknown' };
  let tags: string[] = [txn.channel];
  let uncertainty_reason: string | null = null;

  const raw = txn.raw.toUpperCase();
  const note = txn.note.toUpperCase();
  const name = txn.counterparty_name.toUpperCase();

  // ── SELF TRANSFERS ──────────────────────────────────────────────────
  if (identity.relationship === 'self'
    || /SELF\s*TRANSFER/i.test(raw)
  ) {
    meaning = { type: 'self_transfer', subtype: 'between own accounts', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Self-transfer ${txn.direction === 'debit' ? 'to' : 'from'} own account`;
    affects_pnl = false;
    category = { primary: 'Transfer', secondary: 'Self Transfer' };
    tags.push('self_transfer', 'not_pnl');
  }

  // ── EMI ─────────────────────────────────────────────────────────────
  else if (txn.channel === 'EMI' || /^EMI[\s-]/.test(raw)) {
    const loanMatch = raw.match(/EMI[\s-]+(HOME LOAN|CAR LOAN|PERSONAL LOAN|GOLD LOAN|CONSUMER DURABLE|LAPTOP LOAN|EDUCATION LOAN|BIKE LOAN|TWO WHEELER)/i);
    const loanType = loanMatch ? loanMatch[1] : 'LOAN';
    const acctMatch = raw.match(/A\/C\s*(\w+)/i);
    const emiIdMatch = raw.match(/EMI\s*(\d{6,})/i);
    meaning = {
      type: 'emi',
      subtype: loanType.toLowerCase(),
      loan_id: acctMatch?.[1] || emiIdMatch?.[1] || null,
      loan_type: loanType,
    };
    clarity = 'certain';
    explanation = `${loanType} EMI payment — ₹${txn.amount.toLocaleString('en-IN')}`;
    category = { primary: 'EMI', secondary: loanType };
    tags.push('emi', 'recurring', 'fixed_obligation');
  }

  // ── SALARY ──────────────────────────────────────────────────────────
  else if (/SALARY/i.test(raw) && txn.direction === 'credit') {
    const monthMatch = raw.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{0,4}/i);
    meaning = { type: 'salary', subtype: monthMatch ? `salary ${monthMatch[1]}` : 'monthly salary', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Salary credit from ${txn.counterparty_name}${monthMatch ? ` for ${monthMatch[1]}` : ''}`;
    category = { primary: 'Income', secondary: 'Salary' };
    tags.push('salary', 'income', 'recurring');
  }

  // ── BONUS ───────────────────────────────────────────────────────────
  else if (/BONUS|PERF BONUS|PROJECT COMPLETION BONU/i.test(raw) && txn.direction === 'credit') {
    meaning = { type: 'bonus', subtype: /PERF/i.test(raw) ? 'performance bonus' : 'bonus', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Bonus from ${txn.counterparty_name}`;
    category = { primary: 'Income', secondary: 'Bonus' };
    tags.push('bonus', 'income', 'one_time');
  }

  // ── FREELANCE INCOME ────────────────────────────────────────────────
  else if (identity.relationship === 'freelance_client' || /FREELANCE/i.test(raw)) {
    meaning = { type: 'freelance', subtype: 'consulting/freelance', loan_id: null, loan_type: null };
    clarity = /FREELANCE/i.test(raw) ? 'certain' : 'likely';
    explanation = `Freelance payment from ${txn.counterparty_name}`;
    category = { primary: 'Income', secondary: 'Freelance' };
    tags.push('freelance', 'income', 'variable');
    if (clarity === 'likely') uncertainty_reason = 'Large credit from a company — likely freelance income but not explicitly stated';
  }

  // ── CREDIT CARD PAYMENT ─────────────────────────────────────────────
  else if (txn.channel === 'CC_AUTOPAY' || /CC\s*AUTOPAY|BILLPAY.*CC|BILLPAY.*HDFCSI|TOWARDS CC/i.test(raw)) {
    meaning = { type: 'cc_payment', subtype: 'credit card bill', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = 'Credit card bill payment — not a new expense (already counted when CC was swiped)';
    affects_pnl = false;
    category = { primary: 'Credit Card', secondary: 'Bill Payment' };
    tags.push('cc_payment', 'not_pnl');
  }

  // ── IB BILLPAY (often CC) ───────────────────────────────────────────
  else if (txn.channel === 'IB_BILLPAY') {
    const isCC = /CC|HDFCSI|CARD/i.test(raw);
    if (isCC) {
      meaning = { type: 'cc_payment', subtype: 'cc bill via billpay', loan_id: null, loan_type: null };
      clarity = 'certain';
      explanation = 'Credit card bill payment via Internet Banking';
      affects_pnl = false;
      category = { primary: 'Credit Card', secondary: 'Bill Payment' };
      tags.push('cc_payment', 'not_pnl');
    } else {
      meaning = { type: 'utility', subtype: 'bill payment', loan_id: null, loan_type: null };
      clarity = 'likely';
      explanation = `Bill payment via Internet Banking`;
      category = { primary: 'Utilities', secondary: 'Bill Pay' };
      tags.push('bill_pay');
    }
  }

  // ── INTEREST CREDIT ─────────────────────────────────────────────────
  else if (txn.channel === 'INTEREST' || /INTEREST CREDIT/i.test(raw)) {
    const isFD = /FD|FIXED DEPOSIT/i.test(raw);
    meaning = { type: 'interest', subtype: isFD ? 'FD interest' : 'savings account interest', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = isFD ? 'Fixed deposit interest credit' : 'Savings account interest credit';
    category = { primary: 'Income', secondary: isFD ? 'FD Interest' : 'Bank Interest' };
    tags.push('interest', 'income', 'passive');
  }

  // ── CASHBACK / REWARDS ──────────────────────────────────────────────
  else if (txn.channel === 'CASHBACK' || /CASHBACK|REWARD/i.test(raw)) {
    meaning = { type: 'cashback', subtype: 'rewards', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = 'Cashback or rewards redemption';
    category = { primary: 'Income', secondary: 'Cashback' };
    tags.push('cashback', 'income');
  }

  // ── REFUND / UPI RETURN ─────────────────────────────────────────────
  else if (txn.channel === 'UPI_RETURN' || /REFUND|REVERSAL/i.test(raw)) {
    meaning = { type: 'refund', subtype: 'refund', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = 'Transaction refund / reversal';
    affects_pnl = false; // nets out with original
    category = { primary: 'Refund', secondary: 'Refund' };
    tags.push('refund', 'not_pnl');
  }

  // ── INSURANCE ───────────────────────────────────────────────────────
  else if (identity.relationship === 'insurance_provider' || /INSURANCE|LIC PREMIUM/i.test(raw)) {
    const isHealth = /HEALTH|STAR HEALTH|MEDICLAIM/i.test(raw);
    const isLife = /LIC|LIFE/i.test(raw);
    meaning = { type: 'insurance', subtype: isHealth ? 'health insurance' : isLife ? 'life insurance' : 'insurance', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Insurance premium — ${txn.counterparty_name}`;
    category = { primary: 'Insurance', secondary: isHealth ? 'Health' : isLife ? 'Life' : 'General' };
    tags.push('insurance', 'recurring', 'protection');
  }

  // ── INVESTMENT ──────────────────────────────────────────────────────
  else if (identity.relationship === 'investment_platform'
    || /MUTUAL FUND|SIP|NPS|PPF|STOCK|ZERODHA|ETMONEY|GROWW/i.test(raw)
    || txn.channel === 'RD' || txn.channel === 'FD'
  ) {
    const subtype = /SIP|MUTUAL FUND/i.test(raw) ? 'mutual fund SIP'
      : /NPS/i.test(raw) ? 'NPS'
      : /PPF/i.test(raw) ? 'PPF'
      : /STOCK/i.test(raw) ? 'stocks'
      : /ZERODHA/i.test(raw) ? 'stocks (Zerodha)'
      : txn.channel === 'RD' ? 'recurring deposit'
      : txn.channel === 'FD' ? 'fixed deposit'
      : 'investment';
    meaning = { type: 'investment', subtype, loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Investment — ${subtype}`;
    affects_pnl = false; // capital flow, not expense
    category = { primary: 'Investment', secondary: subtype };
    tags.push('investment', 'not_pnl', 'wealth_building');
  }

  // ── TAX ─────────────────────────────────────────────────────────────
  else if (txn.channel === 'TAX' || /TAX PAYMENT|ADVANCE TAX|CHALLAN|TDS/i.test(raw)) {
    meaning = { type: 'tax', subtype: /ADVANCE/i.test(raw) ? 'advance tax' : 'income tax', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = 'Tax payment to government';
    category = { primary: 'Tax', secondary: 'Income Tax' };
    tags.push('tax', 'mandatory');
  }

  // ── RENT ────────────────────────────────────────────────────────────
  else if (identity.relationship === 'landlord' || /RENT\s*PAYMENT|HOUSE\s*RENT/i.test(raw)) {
    meaning = { type: 'rent', subtype: 'housing rent', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Rent payment to ${txn.counterparty_name}`;
    category = { primary: 'Housing', secondary: 'Rent' };
    tags.push('rent', 'recurring', 'fixed_obligation');
  }

  // ── ATM ─────────────────────────────────────────────────────────────
  else if (txn.channel === 'ATM') {
    meaning = { type: 'atm', subtype: 'cash withdrawal', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Cash withdrawal — ${txn.note || 'ATM'}`;
    category = { primary: 'Cash', secondary: 'ATM Withdrawal' };
    tags.push('atm', 'cash');
  }

  // ── EDUCATION LOAN ──────────────────────────────────────────────────
  else if (/EDUCATION LOAN/i.test(raw)) {
    meaning = { type: 'emi', subtype: 'education loan', loan_id: null, loan_type: 'Education Loan' };
    clarity = 'certain';
    explanation = 'Education loan EMI';
    category = { primary: 'EMI', secondary: 'Education Loan' };
    tags.push('emi', 'education', 'recurring');
  }

  // ── NOW: CONTEXT-BASED UNDERSTANDING ────────────────────────────────
  // The note/narration tells us what the money was ACTUALLY for.

  // Check the NOTE first — it overrides the counterparty
  else if (classifyByNote(note, raw)) {
    const result = classifyByNote(note, raw)!;
    meaning = result.meaning;
    clarity = result.clarity;
    explanation = result.explanation;
    category = result.category;
    tags.push(...result.tags);
  }

  // ── MERCHANT-BASED CLASSIFICATION ───────────────────────────────────
  else if (identity.relationship === 'merchant') {
    const result = classifyMerchant(name, raw, txn);
    meaning = result.meaning;
    clarity = result.clarity;
    explanation = result.explanation;
    category = result.category;
    tags.push(...result.tags);
  }

  // ── FAMILY TRANSFERS ────────────────────────────────────────────────
  else if (identity.relationship === 'spouse_partner') {
    // Check if note reveals purpose
    if (/GROCERY|MEDICINE|HOUSEHOLD|METRO/i.test(note)) {
      const result = classifyByNote(note, raw);
      if (result) {
        meaning = result.meaning;
        clarity = result.clarity;
        explanation = `${txn.counterparty_name} (spouse/partner) — ${result.explanation}`;
        category = result.category;
        tags.push(...result.tags, 'family');
      }
    } else {
      meaning = { type: 'family_transfer', subtype: 'spouse/partner', loan_id: null, loan_type: null };
      clarity = 'likely';
      explanation = `Transfer to ${txn.counterparty_name} (likely spouse/partner — ${identity.transaction_count} transactions found)`;
      category = { primary: 'Family', secondary: 'Spouse/Partner' };
      tags.push('family', 'spouse');
      uncertainty_reason = `Frequent transfers to ${txn.counterparty_name} — is this your spouse/partner?`;
    }
  }

  else if (identity.relationship === 'parent') {
    meaning = { type: 'family_transfer', subtype: 'parent', loan_id: null, loan_type: null };
    clarity = 'certain';
    explanation = `Monthly transfer to parent (${txn.counterparty_name})`;
    category = { primary: 'Family', secondary: 'Parent Support' };
    tags.push('family', 'parent', 'recurring');
  }

  // ── DOMESTIC HELP ───────────────────────────────────────────────────
  else if (identity.relationship === 'domestic_help') {
    meaning = { type: 'domestic_help', subtype: 'household staff', loan_id: null, loan_type: null };
    clarity = 'likely';
    explanation = `Payment to ${txn.counterparty_name} — likely domestic help (₹${txn.amount.toLocaleString('en-IN')}, ${identity.transaction_count} payments)`;
    category = { primary: 'Household', secondary: 'Domestic Help' };
    tags.push('domestic_help', 'recurring');
    uncertainty_reason = `Small recurring payments to ${txn.counterparty_name} — is this domestic help (maid/cook/driver)?`;
  }

  // ── EMPLOYER CREDIT (without SALARY keyword) ────────────────────────
  else if (identity.relationship === 'employer' && txn.direction === 'credit') {
    meaning = { type: 'salary', subtype: 'employer credit', loan_id: null, loan_type: null };
    clarity = 'likely';
    explanation = `Credit from employer ${txn.counterparty_name}`;
    category = { primary: 'Income', secondary: 'Salary' };
    tags.push('salary', 'income');
    uncertainty_reason = `Credit from a company you receive regular salary from — is this a salary payment?`;
  }

  // ── REMAINING UNKNOWN P2P ───────────────────────────────────────────
  else if (identity.relationship === 'unknown_person') {
    meaning = { type: 'vendor_payment', subtype: 'P2P transfer', loan_id: null, loan_type: null };
    clarity = 'unclear';
    explanation = `Payment to ${txn.counterparty_name} — unable to determine purpose`;
    category = { primary: 'Uncategorized', secondary: 'P2P Transfer' };
    tags.push('p2p', 'needs_review');
    uncertainty_reason = `Who is ${txn.counterparty_name}? (e.g., domestic help, vendor, friend, family)`;
  }

  // ── TRULY UNKNOWN ───────────────────────────────────────────────────
  else {
    meaning = { type: 'unknown', subtype: '', loan_id: null, loan_type: null };
    clarity = 'unclear';
    explanation = `Unclassified transaction — ${txn.raw.substring(0, 60)}`;
    category = { primary: 'Uncategorized', secondary: 'Unknown' };
    tags.push('needs_review');
    uncertainty_reason = 'Unable to determine the nature of this transaction';
  }

  return {
    ...txn,
    meaning,
    identity,
    clarity,
    uncertainty_reason,
    explanation,
    affects_pnl,
    category,
    tags,
  };
}


// ---------------------------------------------------------------------------
// NOTE-BASED CLASSIFICATION — The note is often the most revealing signal
// ---------------------------------------------------------------------------

interface ClassificationResult {
  meaning: TransactionMeaning;
  clarity: UnderstoodTransaction['clarity'];
  explanation: string;
  category: { primary: string; secondary: string };
  tags: string[];
}

function classifyByNote(note: string, raw: string): ClassificationResult | null {
  const n = (note + ' ' + raw).toUpperCase();

  // Grocery
  if (/GROCERY|GROCERIES/i.test(n)) return {
    meaning: { type: 'grocery', subtype: 'groceries', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Grocery shopping',
    category: { primary: 'Food & Dining', secondary: 'Groceries' }, tags: ['grocery']
  };

  // Medicines / Health
  if (/MEDICINE|PHARMACY|LAB TEST|DOCTOR|HOSPITAL|DIAGNOSTIC|PRACTO/i.test(n)) return {
    meaning: { type: 'health', subtype: /LAB/i.test(n) ? 'lab tests' : /DOCTOR|PRACTO/i.test(n) ? 'consultation' : 'pharmacy', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: /LAB/i.test(n) ? 'Medical lab tests' : /DOCTOR|PRACTO/i.test(n) ? 'Doctor consultation' : 'Medicines/pharmacy',
    category: { primary: 'Health', secondary: /LAB/i.test(n) ? 'Lab Tests' : /DOCTOR|PRACTO/i.test(n) ? 'Doctor' : 'Pharmacy' }, tags: ['health']
  };

  // Metro / Transit
  if (/METRO|DMRC|RAPIDX/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'metro', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Metro/transit fare',
    category: { primary: 'Transport', secondary: 'Metro' }, tags: ['transport', 'metro']
  };

  // Electricity
  if (/ELECTRIC|BESCOM|BSES|TPDDL|ADANI POWER|MSEDCL/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'electricity', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Electricity bill',
    category: { primary: 'Utilities', secondary: 'Electricity' }, tags: ['utility', 'electricity', 'recurring']
  };

  // Water
  if (/WATER|BWSSB|JAL BOARD/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'water', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Water bill',
    category: { primary: 'Utilities', secondary: 'Water' }, tags: ['utility', 'water']
  };

  // Broadband / Telecom
  if (/BROADBAND|WIFI|INTERNET/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'broadband', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Broadband/internet bill',
    category: { primary: 'Utilities', secondary: 'Broadband' }, tags: ['utility', 'broadband']
  };
  if (/RECHARGE|JIO|AIRTEL|VI\b|BSNL/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'mobile recharge', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Mobile recharge',
    category: { primary: 'Utilities', secondary: 'Telecom' }, tags: ['utility', 'telecom']
  };

  // Food delivery
  if (/FOOD|SWIGGY|ZOMATO|ORDER/i.test(n) && !/SHOPPING/i.test(n)) return {
    meaning: { type: 'food', subtype: 'food delivery', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Food delivery order',
    category: { primary: 'Food & Dining', secondary: 'Delivery' }, tags: ['food', 'delivery']
  };

  // Fuel
  if (/FUEL|PETROL|DIESEL|FILLING STATIO|HP FUEL|BPCL|IOCL/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'fuel', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Fuel purchase',
    category: { primary: 'Transport', secondary: 'Fuel' }, tags: ['transport', 'fuel']
  };

  // Cab / Ride
  if (/CAB|RIDE|UBER|OLA|RAPIDO/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'cab ride', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Cab/ride fare',
    category: { primary: 'Transport', secondary: 'Cab' }, tags: ['transport', 'cab']
  };

  // Parking
  if (/PARKIN/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'parking', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Parking fee',
    category: { primary: 'Transport', secondary: 'Parking' }, tags: ['transport', 'parking']
  };

  // Train / Flight / Travel
  if (/IRCTC|TRAIN/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'train', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Train ticket',
    category: { primary: 'Transport', secondary: 'Train' }, tags: ['transport', 'travel']
  };
  if (/FLIGHT|MAKEMYTRIP|CLEARTRIP/i.test(n)) return {
    meaning: { type: 'travel', subtype: 'flight', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Flight booking',
    category: { primary: 'Travel', secondary: 'Flight' }, tags: ['travel', 'flight']
  };
  if (/HOTEL|BOOKING|GOA|RESORT/i.test(n)) return {
    meaning: { type: 'travel', subtype: 'hotel', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Hotel/travel booking',
    category: { primary: 'Travel', secondary: 'Hotel' }, tags: ['travel', 'hotel']
  };

  // Shopping
  if (/SHOPPING|DIWALI SHOP|YEAR END SALE|ELECTRONICS|CLOTHING|SPORTS GEAR|EYEWEAR/i.test(n)) return {
    meaning: { type: 'shopping', subtype: /ELECTRONICS/i.test(n) ? 'electronics' : /CLOTHING/i.test(n) ? 'clothing' : 'general', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Shopping purchase',
    category: { primary: 'Shopping', secondary: /ELECTRONICS/i.test(n) ? 'Electronics' : /CLOTHING/i.test(n) ? 'Fashion' : 'General' }, tags: ['shopping']
  };

  // Entertainment
  if (/MOVIE|BOOKMYSHOW|PVR|INOX|CINEPOLIS/i.test(n)) return {
    meaning: { type: 'entertainment', subtype: 'movies', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Movie tickets',
    category: { primary: 'Entertainment', secondary: 'Movies' }, tags: ['entertainment']
  };

  // Gym / Fitness
  if (/GYM|CULT\.?FIT|FITNESS|MEMBERSHIP/i.test(n)) return {
    meaning: { type: 'fitness', subtype: 'gym', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Gym/fitness membership',
    category: { primary: 'Health & Fitness', secondary: 'Gym' }, tags: ['fitness', 'recurring']
  };

  // Home services
  if (/HOME CLEANING|URBAN COMPANY|URBANCOMPANY|REPAIR/i.test(n)) return {
    meaning: { type: 'home_services', subtype: 'home services', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Home services',
    category: { primary: 'Home Services', secondary: 'Cleaning/Repair' }, tags: ['home_services']
  };

  // Gift
  if (/VALENTINE|GIFT|FERNS N PETALS|BIRTHDAY|ANNIVERSARY/i.test(n)) return {
    meaning: { type: 'gift', subtype: 'gift', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Gift purchase',
    category: { primary: 'Lifestyle', secondary: 'Gifts' }, tags: ['gift', 'one_time']
  };

  // CRED CC payment
  if (/CRED.*CC|CRED.*BILL|CRED.*REWARD/i.test(n)) return {
    meaning: { type: 'cc_payment', subtype: 'cc via CRED', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Credit card payment via CRED',
    category: { primary: 'Credit Card', secondary: 'Bill Payment' }, tags: ['cc_payment', 'not_pnl']
  };

  // Facewash / personal care mixed with medicines
  if (/FACEWASH|PERSONAL CARE|SKINCARE/i.test(n)) return {
    meaning: { type: 'health', subtype: 'personal care', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Personal care / pharmacy',
    category: { primary: 'Health', secondary: 'Personal Care' }, tags: ['personal_care']
  };

  return null;
}


// ---------------------------------------------------------------------------
// MERCHANT CLASSIFICATION
// ---------------------------------------------------------------------------

function classifyMerchant(name: string, raw: string, txn: DissectedTransaction): ClassificationResult {
  const n = name.toUpperCase();
  const r = raw.toUpperCase();

  // Food delivery
  if (/SWIGGY|ZOMATO|MEATIGO|DAALCHINI/i.test(n)) return {
    meaning: { type: 'food', subtype: 'food delivery', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Food delivery — ${name}`,
    category: { primary: 'Food & Dining', secondary: 'Delivery' }, tags: ['food', 'delivery']
  };

  // Quick commerce / grocery
  if (/BLINKIT|ZEPTO|BIGBASKET|INSTAMART|DUNZO/i.test(n)) return {
    meaning: { type: 'grocery', subtype: 'quick commerce', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Groceries — ${name}`,
    category: { primary: 'Food & Dining', secondary: 'Quick Commerce' }, tags: ['grocery', 'quick_commerce']
  };

  // Grocery stores
  if (/SMART BAZAAR|D.?MART|RELIANCE FRESH|SPAR|BIG BAZAAR|MORE RETAIL/i.test(n)) return {
    meaning: { type: 'grocery', subtype: 'supermarket', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Grocery store — ${name}`,
    category: { primary: 'Food & Dining', secondary: 'Groceries' }, tags: ['grocery', 'supermarket']
  };

  // Restaurants
  if (/HALDIRAM|KHAN CHACHA|PUKHTAAN|BLOOM CAFE|MAGNOLIA|ROYAL SARDAR|SOUTH POINT|DOMINO|STARBUCKS|KFC/i.test(n)) return {
    meaning: { type: 'food', subtype: 'restaurant', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Restaurant/dining — ${name}`,
    category: { primary: 'Food & Dining', secondary: 'Restaurant' }, tags: ['food', 'restaurant']
  };

  // E-commerce
  if (/AMAZON|FLIPKART|MYNTRA|MEESHO|AJIO/i.test(n)) return {
    meaning: { type: 'shopping', subtype: 'e-commerce', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Online shopping — ${name}`,
    category: { primary: 'Shopping', secondary: 'E-commerce' }, tags: ['shopping', 'ecommerce']
  };

  // Fashion / Retail
  if (/NIKE|ADIDAS|ZARA|LENSKART|DECATHLON/i.test(n)) return {
    meaning: { type: 'shopping', subtype: /DECATHLON/i.test(n) ? 'sports gear' : /LENSKART/i.test(n) ? 'eyewear' : 'fashion', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Retail shopping — ${name}`,
    category: { primary: 'Shopping', secondary: /DECATHLON/i.test(n) ? 'Sports' : 'Fashion' }, tags: ['shopping']
  };

  // Transport
  if (/UBER|OLA|RAPIDO/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'cab', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Cab ride — ${name}`,
    category: { primary: 'Transport', secondary: 'Cab' }, tags: ['transport', 'cab']
  };
  if (/DMRC|METRO/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'metro', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Metro fare',
    category: { primary: 'Transport', secondary: 'Metro' }, tags: ['transport', 'metro']
  };
  if (/IRCTC/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'train', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: 'Train ticket',
    category: { primary: 'Transport', secondary: 'Train' }, tags: ['transport', 'train']
  };
  if (/FILLING STATIO|HP FUEL|BPCL|IOCL|INDIAN OIL/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'fuel', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Fuel purchase — ${name}`,
    category: { primary: 'Transport', secondary: 'Fuel' }, tags: ['transport', 'fuel']
  };

  // Health
  if (/APOLLO|PRACTO|1MG|TATA 1MG|PHARMEASY|NETMEDS/i.test(n)) return {
    meaning: { type: 'health', subtype: /PRACTO/i.test(n) ? 'doctor consultation' : 'pharmacy', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Health — ${name}`,
    category: { primary: 'Health', secondary: /PRACTO/i.test(n) ? 'Doctor' : 'Pharmacy' }, tags: ['health']
  };

  // Entertainment
  if (/PVR|INOX|BOOKMYSHOW|CINEPOLIS/i.test(n)) return {
    meaning: { type: 'entertainment', subtype: 'movies', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Movies — ${name}`,
    category: { primary: 'Entertainment', secondary: 'Movies' }, tags: ['entertainment']
  };

  // Travel
  if (/MAKEMYTRIP|CLEARTRIP|GOIBIBO|YATRA/i.test(n)) return {
    meaning: { type: 'travel', subtype: 'travel booking', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Travel booking — ${name}`,
    category: { primary: 'Travel', secondary: 'Booking' }, tags: ['travel']
  };

  // Home services
  if (/URBANCOMPANY|URBAN COMPANY/i.test(n)) return {
    meaning: { type: 'home_services', subtype: 'home services', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Home services — ${name}`,
    category: { primary: 'Home Services', secondary: 'General' }, tags: ['home_services']
  };

  // Fitness
  if (/CULT\.?FIT/i.test(n)) return {
    meaning: { type: 'fitness', subtype: 'gym', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Gym membership — ${name}`,
    category: { primary: 'Health & Fitness', secondary: 'Gym' }, tags: ['fitness']
  };

  // Utilities
  if (/BESCOM|BSES|TPDDL/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'electricity', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Electricity — ${name}`,
    category: { primary: 'Utilities', secondary: 'Electricity' }, tags: ['utility']
  };
  if (/BWSSB|JAL BOARD/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'water', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Water bill — ${name}`,
    category: { primary: 'Utilities', secondary: 'Water' }, tags: ['utility']
  };
  if (/JIO|AIRTEL/i.test(n)) return {
    meaning: { type: 'utility', subtype: 'telecom', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Mobile recharge — ${name}`,
    category: { primary: 'Utilities', secondary: 'Telecom' }, tags: ['utility', 'telecom']
  };

  // Parking / Mall
  if (/PARKING|AMBIENCE MALL|SAHARA MALL/i.test(n)) return {
    meaning: { type: 'transport', subtype: 'parking', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Parking — ${name}`,
    category: { primary: 'Transport', secondary: 'Parking' }, tags: ['transport', 'parking']
  };

  // Investment platforms (that appear as UPI merchants)
  if (/ZERODHA|GROWW|ETMONEY|KUVERA|COIN/i.test(n)) return {
    meaning: { type: 'investment', subtype: /ZERODHA/i.test(n) ? 'stocks' : 'mutual fund', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Investment — ${name}`,
    category: { primary: 'Investment', secondary: /ZERODHA/i.test(n) ? 'Stocks' : 'Mutual Fund' }, tags: ['investment', 'not_pnl']
  };

  // Gift
  if (/FERNS N PETALS/i.test(n)) return {
    meaning: { type: 'gift', subtype: 'gift', loan_id: null, loan_type: null },
    clarity: 'certain', explanation: `Gift — ${name}`,
    category: { primary: 'Lifestyle', secondary: 'Gift' }, tags: ['gift']
  };

  // Fallback merchant
  return {
    meaning: { type: 'unknown', subtype: 'merchant', loan_id: null, loan_type: null },
    clarity: 'likely',
    explanation: `Payment to merchant ${name}`,
    category: { primary: 'Shopping', secondary: 'General' },
    tags: ['merchant']
  };
}


// ---------------------------------------------------------------------------
// MAIN ENTRY POINT — Process all transactions
// ---------------------------------------------------------------------------

export function understandAllTransactions(
  transactions: Array<{
    narration: string;
    debit: number | null;
    credit: number | null;
    balance: number;
    date: string;
    ref?: string;
  }>,
  accountHolderName: string
): {
  understood: UnderstoodTransaction[];
  identities: IdentityMap;
  summary: IntelligenceSummary;
} {
  // Layer 1: Dissect all
  const dissected = transactions.map(t =>
    dissect(t.narration, t.debit, t.credit, t.balance, t.date, t.ref)
  );

  // Layer 2: Build identity map
  const identities = buildIdentityMap(dissected, accountHolderName);

  // Layer 3: Understand each transaction
  const understood = dissected.map(txn => {
    const identity = identities[findCanonical(txn.counterparty_name, identities)]
      || { name: txn.counterparty_name, relationship: 'unknown_person' as const, known_identifiers: [], transaction_count: 1, total_amount: txn.amount };
    return understand(txn, identity, accountHolderName);
  });

  // Layer 4: Generate summary
  const summary = generateSummary(understood, identities);

  return { understood, identities, summary };
}


// ---------------------------------------------------------------------------
// INTELLIGENCE SUMMARY
// ---------------------------------------------------------------------------

export interface IntelligenceSummary {
  /** Transactions we understood with certainty */
  certain_count: number;
  /** Transactions we're fairly sure about */
  likely_count: number;
  /** Transactions we couldn't figure out — ASK THE USER */
  unclear_count: number;
  /** Specific questions to ask the user */
  questions_for_user: UserQuestion[];
  /** Key financial facts we discovered */
  discoveries: string[];
}

export interface UserQuestion {
  /** The person/entity we're asking about */
  entity: string;
  /** The question */
  question: string;
  /** Suggested options */
  options: string[];
  /** How many transactions this affects */
  affected_transactions: number;
  /** Total amount involved */
  total_amount: number;
}

function generateSummary(
  transactions: UnderstoodTransaction[],
  identities: IdentityMap
): IntelligenceSummary {
  const certain_count = transactions.filter(t => t.clarity === 'certain').length;
  const likely_count = transactions.filter(t => t.clarity === 'likely').length;
  const unclear_count = transactions.filter(t => t.clarity === 'unclear').length;

  // Generate questions for unclear entities
  const questions: UserQuestion[] = [];
  const askedEntities = new Set<string>();

  for (const [name, profile] of Object.entries(identities)) {
    if (profile.relationship === 'unknown_person' && !askedEntities.has(name)) {
      askedEntities.add(name);
      questions.push({
        entity: name,
        question: `Who is ${name}?`,
        options: ['Domestic help (maid/cook/driver)', 'Family member', 'Friend', 'Local vendor/shopkeeper', 'Other'],
        affected_transactions: profile.transaction_count,
        total_amount: profile.total_amount,
      });
    }
    if (profile.relationship === 'spouse_partner' && !askedEntities.has(name)) {
      askedEntities.add(name);
      questions.push({
        entity: name,
        question: `Is ${name} your spouse/partner?`,
        options: ['Yes — spouse/partner', 'Family member (not spouse)', 'Friend', 'Other'],
        affected_transactions: profile.transaction_count,
        total_amount: profile.total_amount,
      });
    }
  }

  // Sort questions by impact (total_amount * transaction_count)
  questions.sort((a, b) => (b.total_amount * b.affected_transactions) - (a.total_amount * a.affected_transactions));

  // Generate discoveries
  const discoveries: string[] = [];

  // Salary discovery
  const salaryTxns = transactions.filter(t => t.meaning.type === 'salary');
  if (salaryTxns.length > 0) {
    const employers = [...new Set(salaryTxns.map(t => t.counterparty_name))];
    const avgSalary = salaryTxns.reduce((s, t) => s + t.amount, 0) / salaryTxns.length;
    discoveries.push(`Salary detected: ${employers.join(', ')} — avg ₹${avgSalary.toLocaleString('en-IN')}/month`);
  }

  // EMI burden
  const emiTxns = transactions.filter(t => t.meaning.type === 'emi');
  if (emiTxns.length > 0) {
    const monthlyEMI = emiTxns.reduce((s, t) => s + t.amount, 0) / 6; // approximate monthly
    const totalIncome = transactions.filter(t => t.meaning.type === 'salary').reduce((s, t) => s + t.amount, 0) / 6;
    if (totalIncome > 0) {
      const burden = (monthlyEMI / totalIncome * 100).toFixed(1);
      discoveries.push(`Monthly EMI burden: ₹${monthlyEMI.toLocaleString('en-IN')} (${burden}% of salary)`);
    }
  }

  // Self-transfer volume
  const selfTxns = transactions.filter(t => t.meaning.type === 'self_transfer');
  if (selfTxns.length > 0) {
    const total = selfTxns.reduce((s, t) => s + t.amount, 0);
    discoveries.push(`${selfTxns.length} self-transfers totaling ₹${total.toLocaleString('en-IN')} excluded from P&L`);
  }

  // CC payment volume
  const ccTxns = transactions.filter(t => t.meaning.type === 'cc_payment');
  if (ccTxns.length > 0) {
    const total = ccTxns.reduce((s, t) => s + t.amount, 0);
    discoveries.push(`${ccTxns.length} credit card payments totaling ₹${total.toLocaleString('en-IN')} excluded from P&L (already counted when card was swiped)`);
  }

  return { certain_count, likely_count, unclear_count, questions_for_user: questions, discoveries };
}
