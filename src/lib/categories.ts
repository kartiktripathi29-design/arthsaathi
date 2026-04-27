/**
 * Mega-category system — single source of truth for transaction grouping
 *
 * Maps merchants/keywords to mega-categories. Used by:
 *   - Smart Review (groups related merchants together)
 *   - P&L computation (rolls up expenses)
 *   - Category change modal (lets user reassign)
 *   - Other Income routing (interest/dividends/cashback)
 */

export type MegaCategory =
  | 'salary'        // Salary, regular income
  | 'food'          // Food & Dining
  | 'shopping'      // Shopping (e-commerce + retail)
  | 'investments'   // Investments / SIP
  | 'interest'      // Interest income, dividends → Other Income
  | 'transport'     // Fuel, rideshare, public transport
  | 'entertainment' // OTT, movies, gaming
  | 'utilities'     // Telecom, electricity, gas, internet
  | 'healthcare'    // Pharmacy, hospitals, doctors
  | 'housing'       // Rent, EMI, home loan
  | 'insurance'     // Insurance premiums
  | 'transfer'      // Personal UPI transfers
  | 'cashback'      // Cashbacks, refunds
  | 'misc'          // Everything else

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
  food:          { key:'food',          label:'Food & Dining',            icon:'🍽️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  shopping:      { key:'shopping',      label:'Shopping',                 icon:'🛍️', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  investments:   { key:'investments',   label:'Investments / SIP',        icon:'📈', color:'#2A5A8A', bgColor:'#EEF4FD', borderColor:'#B5D4F4', routesTo:'investment' },
  interest:      { key:'interest',      label:'Interest / Dividends',     icon:'💸', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  transport:     { key:'transport',     label:'Transport & Fuel',         icon:'🚗', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  entertainment: { key:'entertainment', label:'Entertainment & OTT',      icon:'🎬', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  utilities:     { key:'utilities',     label:'Utilities & Recharges',    icon:'⚡', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  healthcare:    { key:'healthcare',    label:'Healthcare & Pharmacy',    icon:'💊', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  housing:       { key:'housing',       label:'Housing (Rent / EMI)',     icon:'🏠', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  insurance:     { key:'insurance',     label:'Insurance',                icon:'🛡️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  transfer:      { key:'transfer',      label:'Personal Transfers',       icon:'👤', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'transfer' },
  cashback:      { key:'cashback',      label:'Cashbacks & Refunds',      icon:'🎁', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  misc:          { key:'misc',          label:'Miscellaneous',            icon:'📦', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
}

// Merchant keyword → mega-category mapping (case-insensitive substring match)
export const MERCHANT_RULES: Array<{ patterns: string[]; mega: MegaCategory; brandName?: string }> = [
  // Food & Dining
  { patterns:['SWIGGY','swiggy'], mega:'food', brandName:'Swiggy' },
  { patterns:['ZOMATO','zomato'], mega:'food', brandName:'Zomato' },
  { patterns:['EATSURE','eatsure'], mega:'food', brandName:'EatSure' },
  { patterns:['DOMINO','PIZZA HUT','MCDONALD','BURGER KING','SUBWAY','KFC'], mega:'food' },
  { patterns:['ZEPTO','BLINKIT','INSTAMART','BIGBASKET','GROFERS','DUNZO'], mega:'food', brandName:'Grocery delivery' },

  // Shopping
  { patterns:['AMAZON','amazon'], mega:'shopping', brandName:'Amazon' },
  { patterns:['FLIPKART','flipkart'], mega:'shopping', brandName:'Flipkart' },
  { patterns:['MYNTRA','myntra'], mega:'shopping', brandName:'Myntra' },
  { patterns:['MEESHO','meesho'], mega:'shopping', brandName:'Meesho' },
  { patterns:['NYKAA','nykaa'], mega:'shopping', brandName:'Nykaa' },
  { patterns:['AJIO','ajio'], mega:'shopping', brandName:'Ajio' },
  { patterns:['PURPLLE','purplle'], mega:'shopping', brandName:'Purplle' },
  { patterns:['DECATHLON','TATA CLIQ','SNAPDEAL','SHOPCLUES','LIMEROAD'], mega:'shopping' },

  // Investments — Groww has special legal name
  { patterns:['NEXTBILLION','BILLIONBRAINS','GROWW','groww'], mega:'investments', brandName:'Groww' },
  { patterns:['ZERODHA','zerodha','KITE.ZERODHA','COIN.ZERODHA'], mega:'investments', brandName:'Zerodha' },
  { patterns:['KUVERA','kuvera'], mega:'investments', brandName:'Kuvera' },
  { patterns:['PAYTM MONEY','paytmmoney'], mega:'investments', brandName:'Paytm Money' },
  { patterns:['INDMONEY','ind money'], mega:'investments', brandName:'INDmoney' },
  { patterns:['ETMONEY','et money'], mega:'investments', brandName:'ETMoney' },
  { patterns:['MFCENTRAL','MF CENTRAL'], mega:'investments' },
  { patterns:['NACH MUTUAL','SIP','MUTUAL FUND','MUTUAL F/'], mega:'investments' },
  { patterns:['GROWW.ICCL','ICCL'], mega:'investments', brandName:'Groww' },

  // Interest / Dividends — these route to Other Income
  { patterns:['INT.PD','INT PD','INTEREST PAID','INTEREST CR','INT.CR'], mega:'interest', brandName:'Bank interest' },
  { patterns:['DIVIDEND','NHPC','COAL INDIA','POWER FINANCE','POWERGRID','ONGC','NTPC','HCL','TCS DIV','RIL DIV'], mega:'interest', brandName:'Dividend' },
  { patterns:['ECS Credit','ECS CR'], mega:'interest', brandName:'Dividend/ECS' },

  // Transport
  { patterns:['UBER','uber'], mega:'transport', brandName:'Uber' },
  { patterns:['OLA','ola cabs'], mega:'transport', brandName:'Ola' },
  { patterns:['RAPIDO','rapido'], mega:'transport', brandName:'Rapido' },
  { patterns:['IRCTC','irctc'], mega:'transport', brandName:'IRCTC' },
  { patterns:['HPCL','BPCL','IOCL','INDIAN OIL','RELIANCE PETRO','NAYARA','SHELL'], mega:'transport', brandName:'Fuel' },
  { patterns:['IOCLIND','PETROL','PUMP','GAS STATION'], mega:'transport', brandName:'Fuel' },
  { patterns:['MAKEMYTRIP','MMT','GOIBIBO','YATRA','EASEMYTRIP','REDBUS'], mega:'transport', brandName:'Travel booking' },

  // Entertainment
  { patterns:['NETFLIX','netflix'], mega:'entertainment', brandName:'Netflix' },
  { patterns:['HOTSTAR','DISNEY+','disney'], mega:'entertainment', brandName:'Hotstar' },
  { patterns:['SPOTIFY','spotify'], mega:'entertainment', brandName:'Spotify' },
  { patterns:['PRIME VIDEO','AMAZON PRIME'], mega:'entertainment', brandName:'Prime Video' },
  { patterns:['BOOKMYSHOW','BMS','PVR','INOX'], mega:'entertainment', brandName:'Movies' },
  { patterns:['SONY LIV','ZEE5','VOOT','JIO CINEMA'], mega:'entertainment' },
  { patterns:['YOUTUBE PREMIUM','APPLE MUSIC'], mega:'entertainment' },

  // Utilities
  { patterns:['AIRTEL','airtel'], mega:'utilities', brandName:'Airtel' },
  { patterns:['JIO','reliance jio'], mega:'utilities', brandName:'Jio' },
  { patterns:['VI','VODAFONE','IDEA','BSNL'], mega:'utilities', brandName:'Telecom' },
  { patterns:['ELECTRICITY','BSES','TATA POWER','BESCOM','MSEDCL','TANGEDCO','APDCL'], mega:'utilities', brandName:'Electricity' },
  { patterns:['GAS','MAHANAGAR GAS','INDRAPRASTHA','IGL','GUJARAT GAS'], mega:'utilities', brandName:'Gas' },
  { patterns:['INTERNET','BROADBAND','ACT FIBERNET','HATHWAY'], mega:'utilities', brandName:'Internet' },
  { patterns:['DTH','DISH TV','TATA SKY','AIRTEL DIGITAL'], mega:'utilities' },
  { patterns:['INDIAN R/SBIN/bdpg2','IRUTS'], mega:'utilities', brandName:'Indian Railways' },

  // Healthcare
  { patterns:['APOLLO','APOLLO HOSP','MEDPLUS','1MG','NETMEDS','PHARMEASY','tata 1mg'], mega:'healthcare', brandName:'Pharmacy' },
  { patterns:['PRACTO','HOSPITAL','CLINIC','LAB','DIAGNOSTICS','THYROCARE','METROPOLIS'], mega:'healthcare' },
  { patterns:['POLICYBA','POLICYBAZAAR'], mega:'healthcare', brandName:'PolicyBazaar' },

  // Housing
  { patterns:['RENT','HOUSE RENT','HOME LOAN','MORTGAGE'], mega:'housing' },
  { patterns:['NACH','NACH DR','NACH DEBIT'], mega:'housing', brandName:'EMI/Loan' },

  // Insurance
  { patterns:['LIC','LIFE INSURANCE','TERM PLAN','POLICY'], mega:'insurance' },
  { patterns:['MEDICLAIM','HEALTH INSURANCE','STAR HEALTH','HDFC ERGO','ICICI LOMBARD','BAJAJ ALLIANZ'], mega:'insurance' },

  // Cashback / Refunds
  { patterns:['CASHBACK','REFUND','RETURN','REVERSAL'], mega:'cashback' },
  { patterns:['GPAYREFUND','GPAY REFUND'], mega:'cashback', brandName:'GPay refund' },

  // Bank charges/SMS as misc
  { patterns:['SMS CHARGE','BANK CHARGE','SERVICE CHARGE','GST'], mega:'misc' },
]

/**
 * Match a transaction description to a mega-category.
 * Returns the most specific match — exits as soon as a pattern matches.
 */
export function matchMega(description: string, currentCategory?: string): { mega: MegaCategory; brand?: string } {
  if (!description) return { mega: 'misc' }
  const desc = description.toUpperCase()

  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) {
        return { mega: rule.mega, brand: rule.brandName }
      }
    }
  }

  // Fall back to existing Claude category if it maps cleanly
  const fallback: Record<string, MegaCategory> = {
    salary: 'salary', rent: 'housing', emi: 'housing',
    grocery: 'food', food: 'food', fuel: 'transport',
    shopping: 'shopping', entertainment: 'entertainment',
    insurance: 'insurance', investment: 'investments', sip: 'investments',
    transfer: 'transfer', utility: 'utilities', medical: 'healthcare',
    education: 'misc', other: 'misc'
  }
  if (currentCategory && fallback[currentCategory]) {
    return { mega: fallback[currentCategory] }
  }

  return { mega: 'misc' }
}

/**
 * Tag every transaction with a mega-category.
 * Adds `.mega` and optionally `.brand` to each transaction.
 */
export function tagTransactions(transactions: any[]): any[] {
  if (!transactions) return []
  return transactions.map(t => {
    const { mega, brand } = matchMega(t.description, t.category)
    return { ...t, mega, brand }
  })
}
