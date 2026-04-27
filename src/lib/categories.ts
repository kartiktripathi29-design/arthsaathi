/**
 * Mega-category system + transaction tagging + salary detection
 * Single source of truth used by Smart Review, P&L, category modal
 */

export type MegaCategory =
  | 'salary' | 'food' | 'shopping' | 'investments' | 'interest'
  | 'transport' | 'entertainment' | 'utilities' | 'healthcare'
  | 'housing' | 'insurance' | 'transfer' | 'cashback' | 'misc'

export interface MegaCategoryInfo {
  key: MegaCategory
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  routesTo?: 'income' | 'expense' | 'investment' | 'transfer'
}

export const MEGA_CATEGORIES: Record<MegaCategory, MegaCategoryInfo> = {
  salary:        { key:'salary',        label:'Salary / Regular Income',  icon:'💰', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  interest:      { key:'interest',      label:'Interest / Dividends',     icon:'💸', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  cashback:      { key:'cashback',      label:'Cashbacks & Refunds',      icon:'🎁', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  food:          { key:'food',          label:'Food & Dining',            icon:'🍽️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  shopping:      { key:'shopping',      label:'Shopping',                 icon:'🛍️', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  investments:   { key:'investments',   label:'Investments / SIP',        icon:'📈', color:'#2A5A8A', bgColor:'#EEF4FD', borderColor:'#B5D4F4', routesTo:'investment' },
  transport:     { key:'transport',     label:'Transport & Fuel',         icon:'🚗', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  entertainment: { key:'entertainment', label:'Entertainment & OTT',      icon:'🎬', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  utilities:     { key:'utilities',     label:'Utilities & Recharges',    icon:'⚡', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  healthcare:    { key:'healthcare',    label:'Healthcare & Pharmacy',    icon:'💊', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  housing:       { key:'housing',       label:'Housing (Rent / EMI)',     icon:'🏠', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  insurance:     { key:'insurance',     label:'Insurance',                icon:'🛡️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  transfer:      { key:'transfer',      label:'Personal Transfers',       icon:'👤', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'transfer' },
  misc:          { key:'misc',          label:'Miscellaneous',            icon:'📦', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
}

export const MERCHANT_RULES: Array<{ patterns: string[]; mega: MegaCategory; brandName?: string }> = [
  // Food & Dining
  { patterns:['SWIGGY'], mega:'food', brandName:'Swiggy' },
  { patterns:['ZOMATO'], mega:'food', brandName:'Zomato' },
  { patterns:['EATSURE'], mega:'food', brandName:'EatSure' },
  { patterns:['DOMINO','PIZZA HUT','MCDONALD','BURGER KING','SUBWAY','KFC'], mega:'food' },
  { patterns:['ZEPTO','BLINKIT','INSTAMART','BIGBASKET','GROFERS','DUNZO'], mega:'food', brandName:'Grocery delivery' },
  // Shopping
  { patterns:['AMAZON'], mega:'shopping', brandName:'Amazon' },
  { patterns:['FLIPKART'], mega:'shopping', brandName:'Flipkart' },
  { patterns:['MYNTRA'], mega:'shopping', brandName:'Myntra' },
  { patterns:['MEESHO'], mega:'shopping', brandName:'Meesho' },
  { patterns:['NYKAA'], mega:'shopping', brandName:'Nykaa' },
  { patterns:['AJIO'], mega:'shopping', brandName:'Ajio' },
  { patterns:['PURPLLE'], mega:'shopping', brandName:'Purplle' },
  { patterns:['DECATHLON','TATA CLIQ','SNAPDEAL','SHOPCLUES'], mega:'shopping' },
  // Investments
  { patterns:['NEXTBILLION','BILLIONBRAINS','GROWW'], mega:'investments', brandName:'Groww' },
  { patterns:['ZERODHA','KITE.ZERODHA','COIN.ZERODHA'], mega:'investments', brandName:'Zerodha' },
  { patterns:['KUVERA'], mega:'investments', brandName:'Kuvera' },
  { patterns:['PAYTM MONEY'], mega:'investments', brandName:'Paytm Money' },
  { patterns:['INDMONEY'], mega:'investments', brandName:'INDmoney' },
  { patterns:['ETMONEY'], mega:'investments', brandName:'ETMoney' },
  { patterns:['MFCENTRAL','MF CENTRAL'], mega:'investments' },
  { patterns:['SIP','MUTUAL FUND','MUTUAL F/'], mega:'investments' },
  { patterns:['ICCL'], mega:'investments', brandName:'Stock exchange' },
  // Interest / Dividends
  { patterns:['INT.PD','INT PD','INTEREST PAID','INTEREST CR','INT.CR'], mega:'interest', brandName:'Bank interest' },
  { patterns:['DIVIDEND','NHPC','COAL INDIA','POWER FINANCE','POWERGRID','ONGC','NTPC'], mega:'interest', brandName:'Dividend' },
  { patterns:['ECS Credit','ECS CR'], mega:'interest', brandName:'Dividend/ECS' },
  // Transport
  { patterns:['UBER'], mega:'transport', brandName:'Uber' },
  { patterns:['OLA'], mega:'transport', brandName:'Ola' },
  { patterns:['RAPIDO'], mega:'transport', brandName:'Rapido' },
  { patterns:['IRCTC'], mega:'transport', brandName:'IRCTC' },
  { patterns:['HPCL','BPCL','IOCL','INDIAN OIL','RELIANCE PETRO','SHELL'], mega:'transport', brandName:'Fuel' },
  { patterns:['IOCLIND','PETROL','PUMP'], mega:'transport', brandName:'Fuel' },
  { patterns:['MAKEMYTRIP','MMT','GOIBIBO','YATRA','EASEMYTRIP','REDBUS'], mega:'transport', brandName:'Travel booking' },
  // Entertainment
  { patterns:['NETFLIX'], mega:'entertainment', brandName:'Netflix' },
  { patterns:['HOTSTAR','DISNEY+'], mega:'entertainment', brandName:'Hotstar' },
  { patterns:['SPOTIFY'], mega:'entertainment', brandName:'Spotify' },
  { patterns:['PRIME VIDEO','AMAZON PRIME'], mega:'entertainment', brandName:'Prime Video' },
  { patterns:['BOOKMYSHOW','BMS','PVR','INOX'], mega:'entertainment', brandName:'Movies' },
  { patterns:['SONY LIV','ZEE5','VOOT','JIO CINEMA'], mega:'entertainment' },
  { patterns:['YOUTUBE PREMIUM','APPLE MUSIC'], mega:'entertainment' },
  // Utilities
  { patterns:['AIRTEL'], mega:'utilities', brandName:'Airtel' },
  { patterns:['JIO'], mega:'utilities', brandName:'Jio' },
  { patterns:['VI ','VODAFONE','IDEA','BSNL'], mega:'utilities', brandName:'Telecom' },
  { patterns:['ELECTRICITY','BSES','TATA POWER','BESCOM','MSEDCL','TANGEDCO'], mega:'utilities', brandName:'Electricity' },
  { patterns:['MAHANAGAR GAS','INDRAPRASTHA','IGL','GUJARAT GAS'], mega:'utilities', brandName:'Gas' },
  { patterns:['INTERNET','BROADBAND','ACT FIBERNET','HATHWAY'], mega:'utilities', brandName:'Internet' },
  { patterns:['DTH','DISH TV','TATA SKY','AIRTEL DIGITAL'], mega:'utilities' },
  { patterns:['INDIAN R/SBIN','IRUTS'], mega:'utilities', brandName:'Indian Railways' },
  // Healthcare
  { patterns:['APOLLO','MEDPLUS','1MG','NETMEDS','PHARMEASY'], mega:'healthcare', brandName:'Pharmacy' },
  { patterns:['PRACTO','HOSPITAL','CLINIC','LAB','DIAGNOSTICS','THYROCARE','METROPOLIS'], mega:'healthcare' },
  { patterns:['POLICYBA','POLICYBAZAAR'], mega:'healthcare', brandName:'PolicyBazaar' },
  // Housing
  { patterns:['RENT','HOUSE RENT','HOME LOAN','MORTGAGE'], mega:'housing' },
  { patterns:['NACH','NACH DR','NACH DEBIT'], mega:'housing', brandName:'EMI/Loan' },
  // Insurance
  { patterns:['LIC','LIFE INSURANCE','TERM PLAN'], mega:'insurance' },
  { patterns:['MEDICLAIM','HEALTH INSURANCE','STAR HEALTH','HDFC ERGO','ICICI LOMBARD','BAJAJ ALLIANZ'], mega:'insurance' },
  // Cashback
  { patterns:['CASHBACK','REFUND','RETURN','REVERSAL'], mega:'cashback' },
  { patterns:['GPAYREFUND','GPAY REFUND'], mega:'cashback', brandName:'GPay refund' },
  // Bank charges
  { patterns:['SMS CHARGE','BANK CHARGE','SERVICE CHARGE','GST'], mega:'misc' },
]

export function matchMega(description: string, currentCategory?: string): { mega: MegaCategory; brand?: string } {
  if (!description) return { mega: 'misc' }
  const desc = description.toUpperCase()
  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) return { mega: rule.mega, brand: rule.brandName }
    }
  }
  const fallback: Record<string, MegaCategory> = {
    salary:'salary', rent:'housing', emi:'housing',
    grocery:'food', food:'food', fuel:'transport',
    shopping:'shopping', entertainment:'entertainment',
    insurance:'insurance', investment:'investments', sip:'investments',
    transfer:'transfer', utility:'utilities', medical:'healthcare',
    education:'misc', other:'misc'
  }
  if (currentCategory && fallback[currentCategory]) return { mega: fallback[currentCategory] }
  return { mega: 'misc' }
}

export function tagTransactions(transactions: any[]): any[] {
  if (!transactions) return []
  return transactions.map((t, i) => {
    const { mega, brand } = matchMega(t.description, t.category)
    // Generate stable id based on date+amount+description+index for individual reassignment
    const id = `t_${i}_${(t.date||'').replace(/[-/]/g,'')}_${Math.round(t.amount)}`
    return { ...t, id, mega, brand }
  })
}

/**
 * Salary detection — find consistent monthly credit patterns
 * Returns array of candidates sorted by confidence
 */
export interface SalaryCandidate {
  source: string         // PALAK D/HDFC etc
  averageAmount: number
  totalAmount: number
  occurrences: number
  variance: number       // 0-1 (0=identical, 1=very different)
  transactions: any[]
  confidence: 'high' | 'medium' | 'low'
}

export function detectSalaryCandidates(transactions: any[]): SalaryCandidate[] {
  const credits = transactions.filter((t:any) => t.type === 'credit' && t.amount >= 5000)
  const groups: Record<string, any[]> = {}
  credits.forEach((t:any) => {
    // Group by source — first segment of description before / or -
    const desc = (t.description || '').trim()
    let key = desc.split(/[/—-]/)[0].trim().substring(0, 30).toUpperCase()
    if (!key) key = 'UNKNOWN'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })

  const candidates: SalaryCandidate[] = []
  Object.entries(groups).forEach(([source, txns]) => {
    if (txns.length < 1) return
    const amounts = txns.map((t:any) => t.amount)
    const avg = amounts.reduce((a:number, b:number) => a + b, 0) / amounts.length
    const maxDev = txns.length > 1
      ? Math.max(...amounts.map((a:number) => Math.abs(a - avg) / avg))
      : 0

    // Skip if amount too small to be salary
    if (avg < 8000) return

    // Confidence rules:
    //  high: 3+ occurrences, variance <20%, avg >15K
    //  medium: 2+ occurrences, variance <30%, avg >10K
    //  low: 1+ occurrence, avg >15K (single big credit)
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (txns.length >= 3 && maxDev < 0.20 && avg >= 15000) confidence = 'high'
    else if (txns.length >= 2 && maxDev < 0.30 && avg >= 10000) confidence = 'medium'
    else if (txns.length >= 1 && avg >= 15000) confidence = 'low'
    else return

    candidates.push({
      source,
      averageAmount: Math.round(avg),
      totalAmount: amounts.reduce((a:number,b:number) => a + b, 0),
      occurrences: txns.length,
      variance: maxDev,
      transactions: txns,
      confidence
    })
  })

  // Sort by confidence then by amount
  const order = { high: 0, medium: 1, low: 2 }
  return candidates.sort((a, b) => order[a.confidence] - order[b.confidence] || b.averageAmount - a.averageAmount)
}
