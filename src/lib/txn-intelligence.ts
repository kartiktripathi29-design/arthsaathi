// ============================================================================
// ArthVo Transaction Intelligence Engine v3
// ============================================================================
//
// PRINCIPLES (learned from a human, not a CA):
//
// 1. NEVER GUESS relationships. Don't call someone "domestic help" or
//    "spouse" based on patterns. Group by person, ask the user.
//
// 2. ONE P&L CATEGORY per transaction. No double counting. Ever.
//    If Nikita Sharma paid for groceries, it's Groceries in the P&L.
//    Not "Family" AND "Groceries" — just Groceries.
//
// 3. TAGS are separate from category. Every transaction can have multiple
//    tags: person name (for reconciliation), channel (for payment mode
//    report), purpose note. Tags don't affect P&L — they enable views.
//
// 4. "Transfer to Persons" is a HOLDING CATEGORY. It's where P2P
//    transactions without a purpose note sit until the user classifies
//    them. The goal is to empty it over time.
//
// 5. PURPOSE > PERSON for P&L. If the note says "GROCERY EXPENSE",
//    the P&L category is Groceries, regardless of who was paid.
//    The person becomes a tag, not the category.
//
// 6. Channel is NEVER a category. UPI/IMPS/NEFT/RTGS are payment rails.
//    They go in tags for the channel report, not in classification.
//
// Architecture: WHAT → WHY → WHO → CLASSIFY (single category + tags)
//
// ============================================================================

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ClassifiedTransaction {
  raw: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  balance: number;
  what: string;
  why: string;
  who: string;
  channel: string;
  category: string;
  subcategory: string;
  is_pnl: boolean;
  clarity: 'certain' | 'ask_user';
  explanation: string;
  tags: string[];
}

export interface PersonLedger {
  name: string;
  transactions: ClassifiedTransaction[];
  total_debit: number;
  total_credit: number;
  net: number;
  count: number;
  classified_count: number;
  unclassified_count: number;
}

export interface ChannelSummary {
  channel: string;
  debit_count: number;
  credit_count: number;
  total_debit: number;
  total_credit: number;
}

export interface PersonQuestion {
  person: string;
  transaction_count: number;
  total_amount: number;
  already_classified: number;
  needs_classification: number;
  question: string;
}

export interface IntelligenceReport {
  transactions: ClassifiedTransaction[];
  pnl: {
    total_income: number;
    total_expense: number;
    net: number;
    by_category: Record<string, { income: number; expense: number; count: number }>;
  };
  persons: PersonLedger[];
  channels: ChannelSummary[];
  questions: PersonQuestion[];
  discoveries: string[];
}

// ---------------------------------------------------------------------------
// PLUMBING STRIPPER
// ---------------------------------------------------------------------------

const PLUMBING_RE = new RegExp(
  [
    '@\\S+',
    '[A-Z]{4}0[A-Z0-9]{6}',
    '\\d{9,}',
    'PAYMENT FROM PHONE?',
    'PAY BY WHATSAPP',
    'P2AMOB',
    'UPIINTENT',
    'IMPS TRANSACTION',
    'NETBANK[,\\s].*$',
  ].join('|'),
  'gi'
);

function cleanEntity(raw: string): string {
  let c = raw.replace(PLUMBING_RE, '');
  c = c.replace(/[^A-Za-z0-9\s&.'()]/g, ' ');
  c = c.replace(/\s+/g, ' ').trim().toUpperCase();
  c = c.replace(/\s+(DR|CR|MUM|CHQ|REF).*$/i, '').trim();
  return c;
}

// ---------------------------------------------------------------------------
// LAYER 1: WHAT
// ---------------------------------------------------------------------------

function extractWhat(raw: string): string {
  const r = raw.trim().toUpperCase();
  if (r.startsWith('UPIRET'))                                return 'RETURN';
  if (r.startsWith('EMI') || /^EMI[\s-]/.test(r))           return 'EMI';
  if (r.includes('CC') && r.includes('AUTOPAY'))             return 'CC_PAYMENT';
  if (r.startsWith('IB BILLPAY'))                            return 'BILL_PAYMENT';
  if (/^(ACH|NACH)\s*[DC]?-/i.test(r))                      return 'AUTO_DEBIT';
  if (r.startsWith('RD ') || r.includes('RECURRING DEPOSIT')) return 'RECURRING_DEPOSIT';
  if (r.includes('INTEREST CREDIT') || /^INT\//.test(r))     return 'INTEREST_CREDIT';
  if (r.includes('CASHBACK') || r.includes('REWARD'))        return 'CASHBACK';
  if (r.includes('TAX PAYMENT') || r.includes('ADVANCE TAX')) return 'TAX_PAYMENT';
  if (r.includes('ATM') && r.includes('WDL'))                return 'CASH_WITHDRAWAL';
  if (r.includes('SELF TRANSFER'))                           return 'SELF_TRANSFER';
  if (r.includes('SALARY'))                                  return 'SALARY';
  if (/BONUS|PERF\s*BONUS/.test(r))                          return 'BONUS';
  if (r.includes('FREELANCE'))                               return 'FREELANCE_INCOME';
  if (/RENT\s*PAYMENT|HOUSE\s*RENT/.test(r))                 return 'RENT';
  return 'TRANSFER';
}

// ---------------------------------------------------------------------------
// LAYER 2: WHY
// ---------------------------------------------------------------------------

function extractWhy(raw: string, what: string): string {
  const r = raw.trim();
  const selfDeclared: Record<string, string> = {
    'RETURN': 'REFUND/RETURN', 'CC_PAYMENT': 'CREDIT CARD BILL',
    'INTEREST_CREDIT': 'INTEREST', 'CASHBACK': 'CASHBACK',
    'TAX_PAYMENT': 'TAX', 'CASH_WITHDRAWAL': 'CASH',
    'RECURRING_DEPOSIT': 'RECURRING DEPOSIT',
  };
  if (selfDeclared[what]) return selfDeclared[what];

  if (what === 'EMI') {
    const m = r.toUpperCase().match(/(HOME LOAN|CAR LOAN|PERSONAL LOAN|GOLD LOAN|CONSUMER DURABLE|LAPTOP LOAN|EDUCATION LOAN|BIKE LOAN)/);
    return m ? m[1] : 'LOAN EMI';
  }
  if (what === 'BILL_PAYMENT') {
    if (r.toUpperCase().includes('HDFCSI') || /\d{6}X{4,}\d{4}/.test(r)) return 'CREDIT CARD BILL';
    return 'BILL PAYMENT';
  }
  if (what === 'AUTO_DEBIT') {
    return r.replace(/^(NACH|ACH)\s*[DC]?-?\s*/i, '').trim();
  }

  if (r.toUpperCase().startsWith('UPI-')) {
    const parts = r.substring(4).split('-');
    if (parts.length >= 5) {
      let note = parts.slice(4).join('-').trim();
      note = note.replace(/^\d{10,}[-]?/, '');
      note = note.replace(/PAYMENT FROM PHONE?/gi, '');
      note = note.replace(/PAY BY WHATSAPP/gi, '');
      note = note.replace(/^[-\s]+|[-\s]+$/g, '').trim();
      if (note.length > 2) return note;
    }
  }

  if (r.toUpperCase().startsWith('IMPS')) {
    const parts = r.split('-');
    if (parts.length >= 5) {
      const last = parts[parts.length - 1].trim();
      if (last && !['P2AMOB', 'IMPS TRANSACTION'].includes(last.toUpperCase()) && last.length > 3) {
        return last;
      }
    }
  }

  return '';
}

// ---------------------------------------------------------------------------
// LAYER 3: WHO
// ---------------------------------------------------------------------------

function extractWho(raw: string, what: string): string {
  const r = raw.trim();
  if (['RETURN', 'INTEREST_CREDIT', 'CASHBACK', 'CASH_WITHDRAWAL', 'TAX_PAYMENT'].includes(what)) return '';
  if (['EMI', 'RECURRING_DEPOSIT', 'SELF_TRANSFER', 'CC_PAYMENT'].includes(what)) return '';
  if (what === 'BILL_PAYMENT') {
    const cleaned = r.replace(/^IB\s*BILLPAY\s*DR-/i, '').trim();
    const entity = cleaned.split('-')[0].trim().toUpperCase();
    if (entity === 'HDFCSI') return 'HDFC CREDIT CARD';
    return cleanEntity(entity);
  }
  if (what === 'AUTO_DEBIT') {
    const cleaned = r.replace(/^(NACH|ACH)\s*[DC]?-?\s*/i, '').trim();
    return cleanEntity(cleaned.split('-')[0]);
  }
  if (r.toUpperCase().startsWith('UPI-')) {
    const parts = r.substring(4).split('-');
    if (parts.length >= 1) return cleanEntity(parts[0]);
  }
  if (r.toUpperCase().startsWith('IMPS')) {
    const parts = r.split('-');
    if (parts.length >= 3) return cleanEntity(parts[2]);
  }
  if (/^(NEFT|RTGS)/i.test(r)) {
    const cleaned = r.replace(/^(NEFT|RTGS)\s*(CR|DR)?-?/i, '').trim();
    const parts = cleaned.split('-');
    if (parts.length >= 2 && /^[A-Z]{4}0/i.test(parts[0].trim())) return cleanEntity(parts[1]);
    return cleanEntity(parts[0]);
  }
  return cleanEntity(r.substring(0, 50));
}

// ---------------------------------------------------------------------------
// CHANNEL
// ---------------------------------------------------------------------------

function extractChannel(raw: string): string {
  const r = raw.trim().toUpperCase();
  if (r.startsWith('UPIRET') || r.startsWith('UPI-') || r.startsWith('UPI/')) return 'UPI';
  if (r.startsWith('IMPS')) return 'IMPS';
  if (r.startsWith('NEFT')) return 'NEFT';
  if (r.startsWith('RTGS')) return 'RTGS';
  if (r.startsWith('ACH') || r.startsWith('NACH')) return 'ACH/NACH';
  if (r.startsWith('IB BILLPAY')) return 'Net Banking';
  if (/^EMI[\s-]/.test(r) || (r.includes('CC') && r.includes('AUTOPAY')) || r.startsWith('RD ')) return 'Auto-Debit';
  if (r.includes('ATM')) return 'ATM';
  return 'Other';
}

// ---------------------------------------------------------------------------
// KNOWN ENTITIES
// ---------------------------------------------------------------------------

interface KnownEntity { category: string; subcategory: string; is_pnl: boolean; }

const KNOWN_ENTITIES: Record<string, KnownEntity> = {
  'ETMONEY':           { category: 'Investment', subcategory: 'SIP/Mutual Fund', is_pnl: false },
  'ZERODHA':           { category: 'Investment', subcategory: 'Stocks', is_pnl: false },
  'GROWW':             { category: 'Investment', subcategory: 'Mutual Fund', is_pnl: false },
  'KUVERA':            { category: 'Investment', subcategory: 'Mutual Fund', is_pnl: false },
  'LIC OF INDIA':      { category: 'Insurance', subcategory: 'Life Insurance', is_pnl: true },
  'LIC':               { category: 'Insurance', subcategory: 'Life Insurance', is_pnl: true },
  'STAR HEALTH':       { category: 'Insurance', subcategory: 'Health Insurance', is_pnl: true },
  'SWIGGY':            { category: 'Food & Dining', subcategory: 'Delivery', is_pnl: true },
  'SWIGGY INSTAMART':  { category: 'Food & Dining', subcategory: 'Quick Commerce', is_pnl: true },
  'ZOMATO':            { category: 'Food & Dining', subcategory: 'Delivery', is_pnl: true },
  'MEATIGO':           { category: 'Food & Dining', subcategory: 'Delivery', is_pnl: true },
  'DAALCHINI':         { category: 'Food & Dining', subcategory: 'Vending', is_pnl: true },
  'BLINKIT':           { category: 'Food & Dining', subcategory: 'Quick Commerce', is_pnl: true },
  'ZEPTO':             { category: 'Food & Dining', subcategory: 'Quick Commerce', is_pnl: true },
  'BIGBASKET':         { category: 'Food & Dining', subcategory: 'Quick Commerce', is_pnl: true },
  'SMART BAZAAR':      { category: 'Food & Dining', subcategory: 'Groceries', is_pnl: true },
  'DMART':             { category: 'Food & Dining', subcategory: 'Groceries', is_pnl: true },
  'HALDIRAM':          { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  'KHAN CHACHA':       { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  'PUKHTAAN':          { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  'BLOOM CAFE':        { category: 'Food & Dining', subcategory: 'Cafe', is_pnl: true },
  'MAGNOLIA BAKERY':   { category: 'Food & Dining', subcategory: 'Bakery', is_pnl: true },
  'ROYAL SARDAR':      { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  'SOUTH POINT':       { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  'DMRC':              { category: 'Transport', subcategory: 'Metro', is_pnl: true },
  'UBER':              { category: 'Transport', subcategory: 'Cab', is_pnl: true },
  'UBER INDIA':        { category: 'Transport', subcategory: 'Cab', is_pnl: true },
  'OLA':               { category: 'Transport', subcategory: 'Cab', is_pnl: true },
  'IRCTC':             { category: 'Transport', subcategory: 'Train', is_pnl: true },
  'JANTA FILLING STATION': { category: 'Transport', subcategory: 'Fuel', is_pnl: true },
  'HP FUEL':           { category: 'Transport', subcategory: 'Fuel', is_pnl: true },
  'AMBIENCE MALL':     { category: 'Transport', subcategory: 'Parking', is_pnl: true },
  'AMAZON':            { category: 'Shopping', subcategory: 'E-commerce', is_pnl: true },
  'AMAZON INDIA':      { category: 'Shopping', subcategory: 'E-commerce', is_pnl: true },
  'FLIPKART':          { category: 'Shopping', subcategory: 'E-commerce', is_pnl: true },
  'MYNTRA':            { category: 'Shopping', subcategory: 'Fashion', is_pnl: true },
  'NIKE':              { category: 'Shopping', subcategory: 'Fashion', is_pnl: true },
  'NIKE BHANNE RETAIL': { category: 'Shopping', subcategory: 'Fashion', is_pnl: true },
  'LENSKART':          { category: 'Shopping', subcategory: 'Eyewear', is_pnl: true },
  'DECATHLON':         { category: 'Shopping', subcategory: 'Sports', is_pnl: true },
  'SAHARA MALL':       { category: 'Shopping', subcategory: 'Mall', is_pnl: true },
  'APOLLO PHARMACY':   { category: 'Health', subcategory: 'Pharmacy', is_pnl: true },
  'PRACTO':            { category: 'Health', subcategory: 'Doctor', is_pnl: true },
  'TATA 1MG':          { category: 'Health', subcategory: 'Pharmacy', is_pnl: true },
  '1MG':               { category: 'Health', subcategory: 'Pharmacy', is_pnl: true },
  'PVR':               { category: 'Entertainment', subcategory: 'Movies', is_pnl: true },
  'PVR INOX':          { category: 'Entertainment', subcategory: 'Movies', is_pnl: true },
  'BOOKMYSHOW':        { category: 'Entertainment', subcategory: 'Movies', is_pnl: true },
  'NETFLIX':           { category: 'Entertainment', subcategory: 'Subscription', is_pnl: true },
  'JIO RECHARGE':      { category: 'Utilities', subcategory: 'Telecom', is_pnl: true },
  'AIRTEL RECHARGE':   { category: 'Utilities', subcategory: 'Telecom', is_pnl: true },
  'RELIANCE JIO':      { category: 'Utilities', subcategory: 'Telecom', is_pnl: true },
  'BESCOM':            { category: 'Utilities', subcategory: 'Electricity', is_pnl: true },
  'BWSSB':             { category: 'Utilities', subcategory: 'Water', is_pnl: true },
  'URBANCOMPANY':      { category: 'Home Services', subcategory: 'General', is_pnl: true },
  'URBAN COMPANY':     { category: 'Home Services', subcategory: 'General', is_pnl: true },
  'MAKEMYTRIP':        { category: 'Travel', subcategory: 'Booking', is_pnl: true },
  'CLEARTRIP':         { category: 'Travel', subcategory: 'Booking', is_pnl: true },
  'VAKILSEARCH':       { category: 'Professional', subcategory: 'Legal', is_pnl: true },
  'BANANACLUB':        { category: 'Lifestyle', subcategory: 'General', is_pnl: true },
  'FERNS N PETALS':    { category: 'Lifestyle', subcategory: 'Gift', is_pnl: true },
  'CRED':              { category: 'Credit Card', subcategory: 'Bill Payment', is_pnl: false },
};

function matchKnownEntity(who: string): KnownEntity | null {
  const u = who.toUpperCase().trim();
  if (!u) return null;
  if (KNOWN_ENTITIES[u]) return KNOWN_ENTITIES[u];
  for (const [name, entity] of Object.entries(KNOWN_ENTITIES)) {
    if (u.includes(name) || name.includes(u)) return entity;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PURPOSE → CATEGORY
// ---------------------------------------------------------------------------

function matchPurpose(why: string): { category: string; subcategory: string } | null {
  const w = why.toUpperCase();
  if (/REFUND|REVERSAL/.test(w)) return { category: 'Refund', subcategory: 'Refund' };
  if (/TOWARDS CC|CC PAYMENT|CC BILL/.test(w)) return { category: 'Credit Card', subcategory: 'Bill Payment' };
  if (/GROCERY|GROCERIES/.test(w)) return { category: 'Food & Dining', subcategory: 'Groceries' };
  if (/FOOD ORDER|FOOD DELIVERY/.test(w)) return { category: 'Food & Dining', subcategory: 'Delivery' };
  if (/MEDICINE|PHARMACY|FACEWASH|SKINCARE/.test(w)) return { category: 'Health', subcategory: 'Pharmacy/Personal Care' };
  if (/LAB TEST|DOCTOR|CONSULTATION/.test(w)) return { category: 'Health', subcategory: 'Medical' };
  if (/METRO EXPENSE/.test(w)) return { category: 'Transport', subcategory: 'Metro' };
  if (/FUEL|PETROL|DIESEL/.test(w)) return { category: 'Transport', subcategory: 'Fuel' };
  if (/CAB|RIDE/.test(w)) return { category: 'Transport', subcategory: 'Cab' };
  if (/HOUSEHOLD/.test(w)) return { category: 'Household', subcategory: 'Expense' };
  if (/RECHARGE/.test(w)) return { category: 'Utilities', subcategory: 'Telecom' };
  if (/ELECTRIC|BESCOM|BSES|TPDDL/.test(w)) return { category: 'Utilities', subcategory: 'Electricity' };
  if (/WATER|BWSSB/.test(w)) return { category: 'Utilities', subcategory: 'Water' };
  if (/BROADBAND|WIFI|INTERNET/.test(w)) return { category: 'Utilities', subcategory: 'Broadband' };
  if (/SHOPPING|ELECTRONICS|CLOTHING/.test(w)) return { category: 'Shopping', subcategory: 'General' };
  if (/MOVIE|FILM/.test(w)) return { category: 'Entertainment', subcategory: 'Movies' };
  if (/HOTEL|FLIGHT|TRAVEL|BOOKING/.test(w)) return { category: 'Travel', subcategory: 'Booking' };
  if (/GYM|FITNESS|MEMBERSHIP/.test(w)) return { category: 'Health & Fitness', subcategory: 'Gym' };
  if (/VALENTINE|GIFT|BIRTHDAY/.test(w)) return { category: 'Lifestyle', subcategory: 'Gift' };
  if (/HOME CLEANING|REPAIR/.test(w)) return { category: 'Home Services', subcategory: 'General' };
  return null;
}

// ---------------------------------------------------------------------------
// CLASSIFY
// ---------------------------------------------------------------------------

function classify(
  what: string, why: string, who: string, channel: string,
  amount: number, direction: 'debit' | 'credit', accountHolderName: string,
): { category: string; subcategory: string; is_pnl: boolean; clarity: 'certain' | 'ask_user'; explanation: string; tags: string[] } {
  const tags: string[] = [`channel:${channel}`];
  if (who && who.length > 1) tags.push(`person:${who}`);

  // WHAT-based
  const whatMap: Record<string, { cat: string; sub: string; pnl: boolean; expl: string }> = {
    'RETURN':            { cat: 'Refund', sub: 'UPI Return', pnl: false, expl: 'Transaction return/reversal' },
    'SELF_TRANSFER':     { cat: 'Self Transfer', sub: '', pnl: false, expl: 'Transfer between own accounts' },
    'CC_PAYMENT':        { cat: 'Credit Card', sub: 'Bill Payment', pnl: false, expl: 'CC bill — already counted at swipe' },
    'SALARY':            { cat: 'Income', sub: 'Salary', pnl: true, expl: `Salary from ${who}` },
    'BONUS':             { cat: 'Income', sub: 'Bonus', pnl: true, expl: `Bonus from ${who}` },
    'FREELANCE_INCOME':  { cat: 'Income', sub: 'Freelance', pnl: true, expl: `Freelance from ${who}` },
    'RENT':              { cat: 'Housing', sub: 'Rent', pnl: true, expl: 'Rent payment' },
    'INTEREST_CREDIT':   { cat: 'Income', sub: 'Interest', pnl: true, expl: 'Bank interest' },
    'CASHBACK':          { cat: 'Income', sub: 'Cashback', pnl: true, expl: 'Cashback/rewards' },
    'TAX_PAYMENT':       { cat: 'Tax', sub: 'Income Tax', pnl: true, expl: 'Tax payment' },
    'CASH_WITHDRAWAL':   { cat: 'Cash', sub: 'ATM', pnl: true, expl: 'Cash withdrawal' },
    'RECURRING_DEPOSIT': { cat: 'Investment', sub: 'Recurring Deposit', pnl: false, expl: 'Recurring deposit' },
  };

  if (whatMap[what]) {
    const m = whatMap[what];
    return { category: m.cat, subcategory: m.sub, is_pnl: m.pnl, clarity: 'certain', explanation: m.expl, tags };
  }

  if (what === 'EMI') {
    const loan = why !== 'LOAN EMI' ? why : 'Loan';
    return { category: 'EMI', subcategory: loan, is_pnl: true, clarity: 'certain', explanation: `${loan} EMI`, tags };
  }

  if (what === 'BILL_PAYMENT') {
    if (why.toUpperCase().includes('CREDIT CARD')) {
      return { category: 'Credit Card', subcategory: 'Bill Payment', is_pnl: false, clarity: 'certain', explanation: 'CC bill via BILLPAY', tags };
    }
    return { category: 'Utilities', subcategory: 'Bill Payment', is_pnl: true, clarity: 'certain', explanation: 'Bill payment', tags };
  }

  // WHY-based
  const purpose = matchPurpose(why);
  if (purpose) {
    const isPnl = !['Refund', 'Credit Card'].includes(purpose.category);
    return { category: purpose.category, subcategory: purpose.subcategory, is_pnl: isPnl, clarity: 'certain',
      explanation: `${purpose.subcategory}${who ? ` (paid via ${who})` : ''}`, tags };
  }

  // WHO-based
  const known = matchKnownEntity(who);
  if (known) {
    return { category: known.category, subcategory: known.subcategory, is_pnl: known.is_pnl, clarity: 'certain',
      explanation: who, tags };
  }

  // AUTO_DEBIT keywords
  if (what === 'AUTO_DEBIT') {
    const wu = who.toUpperCase();
    if (/MUTUAL FUND|SIP/.test(wu)) return { category: 'Investment', subcategory: 'SIP/Mutual Fund', is_pnl: false, clarity: 'certain', explanation: 'MF SIP', tags };
    if (/NPS/.test(wu)) return { category: 'Investment', subcategory: 'NPS', is_pnl: false, clarity: 'certain', explanation: 'NPS contribution', tags };
    if (/PPF/.test(wu)) return { category: 'Investment', subcategory: 'PPF', is_pnl: false, clarity: 'certain', explanation: 'PPF deposit', tags };
    if (/EDUCATION LOAN/.test(wu)) return { category: 'EMI', subcategory: 'Education Loan', is_pnl: true, clarity: 'certain', explanation: 'Education loan EMI', tags };
    if (/LIC|INSURANCE/.test(wu)) return { category: 'Insurance', subcategory: 'Premium', is_pnl: true, clarity: 'certain', explanation: 'Insurance premium', tags };
    return { category: 'Auto-Debit', subcategory: 'Unknown', is_pnl: true, clarity: 'ask_user', explanation: `Auto-debit to ${who}`, tags };
  }

  // Self by name match
  const hw = accountHolderName.toUpperCase().split(/\s+/).filter(w => w.length > 2);
  if (hw.length >= 2 && hw.every(w => who.toUpperCase().includes(w))) {
    return { category: 'Self Transfer', subcategory: '', is_pnl: false, clarity: 'certain', explanation: 'Self-transfer (name match)', tags };
  }

  // Masked account number
  if (/^X{3,}\d+$/.test(who) || /^\d+X+\d*$/.test(who)) {
    return { category: 'Transfer to Account', subcategory: who, is_pnl: true, clarity: 'ask_user', explanation: `Transfer to masked account ${who}`, tags };
  }

  // Large company credit
  if (direction === 'credit' && amount > 20000 && /PRIVATE LIMITED|PVT LTD|TECHNOLOGIES|SOLUTIONS/.test(who.toUpperCase())) {
    tags.push('income');
    return { category: 'Income', subcategory: 'Business (unconfirmed)', is_pnl: true, clarity: 'ask_user', explanation: `Credit from ${who}`, tags };
  }

  // P2P — holding category, no guessing
  return { category: 'Transfer to Persons', subcategory: who || 'Unknown', is_pnl: true, clarity: 'ask_user',
    explanation: who ? `Payment to ${who}` : 'Unknown transfer', tags };
}

// ---------------------------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------------------------

export function analyzeStatement(
  transactions: Array<{ narration: string; debit: number | null; credit: number | null; balance: number; date: string }>,
  accountHolderName: string
): IntelligenceReport {

  const classified: ClassifiedTransaction[] = transactions.map(t => {
    const raw = t.narration;
    const amount = t.debit ?? t.credit ?? 0;
    const direction: 'debit' | 'credit' = (t.debit && t.debit > 0) ? 'debit' : 'credit';
    const what = extractWhat(raw);
    const why = extractWhy(raw, what);
    const who = extractWho(raw, what);
    const channel = extractChannel(raw);
    const r = classify(what, why, who, channel, amount, direction, accountHolderName);
    return { raw, date: t.date, amount, direction, balance: t.balance, what, why, who, channel, ...r };
  });

  // P&L (single count per transaction)
  const byCategory: Record<string, { income: number; expense: number; count: number }> = {};
  let totalIncome = 0, totalExpense = 0;
  for (const t of classified) {
    if (!t.is_pnl) continue;
    if (!byCategory[t.category]) byCategory[t.category] = { income: 0, expense: 0, count: 0 };
    byCategory[t.category].count++;
    if (t.direction === 'credit') { byCategory[t.category].income += t.amount; totalIncome += t.amount; }
    else { byCategory[t.category].expense += t.amount; totalExpense += t.amount; }
  }

  // Person ledger (from tags)
  const personMap = new Map<string, ClassifiedTransaction[]>();
  for (const t of classified) {
    const pt = t.tags.find(tag => tag.startsWith('person:'));
    if (pt) {
      const name = pt.substring(7);
      if (!personMap.has(name)) personMap.set(name, []);
      personMap.get(name)!.push(t);
    }
  }
  const persons: PersonLedger[] = Array.from(personMap.entries()).map(([name, txns]) => ({
    name, transactions: txns,
    total_debit: txns.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0),
    total_credit: txns.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0),
    net: txns.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0) - txns.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0),
    count: txns.length,
    classified_count: txns.filter(t => t.category !== 'Transfer to Persons').length,
    unclassified_count: txns.filter(t => t.category === 'Transfer to Persons').length,
  })).sort((a, b) => b.count - a.count);

  // Channel summary (from tags)
  const channelMap = new Map<string, ChannelSummary>();
  for (const t of classified) {
    const ct = t.tags.find(tag => tag.startsWith('channel:'));
    const ch = ct ? ct.substring(8) : 'Other';
    if (!channelMap.has(ch)) channelMap.set(ch, { channel: ch, debit_count: 0, credit_count: 0, total_debit: 0, total_credit: 0 });
    const s = channelMap.get(ch)!;
    if (t.direction === 'debit') { s.debit_count++; s.total_debit += t.amount; }
    else { s.credit_count++; s.total_credit += t.amount; }
  }
  const channels = Array.from(channelMap.values()).sort((a, b) => (b.total_debit + b.total_credit) - (a.total_debit + a.total_credit));

  // Questions (grouped by person)
  const questions: PersonQuestion[] = persons
    .filter(p => p.unclassified_count > 0)
    .map(p => ({
      person: p.name, transaction_count: p.count,
      total_amount: p.total_debit + p.total_credit,
      already_classified: p.classified_count,
      needs_classification: p.unclassified_count,
      question: p.count > 1
        ? `You have ${p.count} transactions with ${p.name}. Who is this person?`
        : `Who is ${p.name}?`,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);

  // Discoveries
  const discoveries: string[] = [];
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const salaryTxns = classified.filter(t => t.subcategory === 'Salary');
  if (salaryTxns.length) discoveries.push(`Salary from: ${[...new Set(salaryTxns.map(t => t.who))].filter(Boolean).join(', ')}`);
  const emiTxns = classified.filter(t => t.category === 'EMI');
  if (emiTxns.length) discoveries.push(`${emiTxns.length} EMI payments totaling ${fmt(emiTxns.reduce((s, t) => s + t.amount, 0))}`);
  const selfTxns = classified.filter(t => t.category === 'Self Transfer');
  if (selfTxns.length) discoveries.push(`${selfTxns.length} self-transfers (${fmt(selfTxns.reduce((s, t) => s + t.amount, 0))}) excluded from P&L`);
  const ccTxns = classified.filter(t => t.category === 'Credit Card');
  if (ccTxns.length) discoveries.push(`${ccTxns.length} CC payments (${fmt(ccTxns.reduce((s, t) => s + t.amount, 0))}) excluded — already counted at swipe`);
  const investTxns = classified.filter(t => t.category === 'Investment');
  if (investTxns.length) discoveries.push(`${investTxns.length} investments (${fmt(investTxns.reduce((s, t) => s + t.amount, 0))}) — capital flow, not expense`);
  const p2pTxns = classified.filter(t => t.category === 'Transfer to Persons');
  if (p2pTxns.length) discoveries.push(`${p2pTxns.length} P2P transfers to ${new Set(p2pTxns.map(t => t.who)).size} people (${fmt(p2pTxns.reduce((s, t) => s + t.amount, 0))}) — awaiting classification`);

  return {
    transactions: classified,
    pnl: { total_income: totalIncome, total_expense: totalExpense, net: totalIncome - totalExpense, by_category: byCategory },
    persons, channels, questions, discoveries,
  };
}
