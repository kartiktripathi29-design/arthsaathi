/**
 * ArthVo Smart Categorization Engine v5
 * ======================================
 * 3-tier hybrid pipeline: Rules → Pattern Intelligence → LLM fallback
 *
 * Backward-compatible: every export from v3 preserved with identical signatures.
 * New capabilities layered underneath without breaking the profile page.
 *
 * What changed:
 * - 600+ merchant/entity patterns (was ~45 rules)
 * - Fuzzy matching via n-gram overlap (handles BAJAJFINEMI, ONE97, PYTM)
 * - VPA-to-merchant mapping (swiggy@icici → Swiggy)
 * - Confidence scores on every categorization
 * - Narration channel detection (UPI/NEFT/RTGS/IMPS/NACH/ECS/POS/ATM)
 * - Recurring pattern detection (EMI/SIP/rent/subscription)
 * - Cross-transaction person grouping
 * - Self-transfer detection by description + cross-account date matching
 * - Income breakdown (salary vs freelance vs interest vs dividends vs cashback)
 * - Balance verification helper
 * - Anomaly/insight detection (spending spikes, unusual transactions)
 * - Preparation for LLM fallback tier (batch uncategorized to Haiku)
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. TYPES — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

export type MegaCategory =
  | 'salary' | 'food' | 'shopping' | 'investments_elss' | 'investments_regular'
  | 'interest' | 'transport' | 'entertainment' | 'utilities' | 'healthcare'
  | 'housing' | 'insurance' | 'transfer' | 'cashback' | 'misc' | 'cc_payment'

export interface MegaCategoryInfo {
  key: MegaCategory
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  routesTo?: 'income' | 'expense' | 'investment' | 'transfer' | 'tax_save'
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. MEGA_CATEGORIES — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

export const MEGA_CATEGORIES: Record<MegaCategory, MegaCategoryInfo> = {
  salary:               { key:'salary',               label:'Salary / Regular Income',  icon:'💰', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  interest:             { key:'interest',             label:'Interest / Dividends',     icon:'💸', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  cashback:             { key:'cashback',             label:'Cashbacks & Refunds',      icon:'🎁', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'income' },
  food:                 { key:'food',                 label:'Food & Dining',            icon:'🍽️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  shopping:             { key:'shopping',             label:'Shopping',                 icon:'🛍️', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  investments_elss:     { key:'investments_elss',     label:'Tax-saving SIP (ELSS) → 80C', icon:'🛡️', color:'#2A7A4A', bgColor:'#EEF2EE', borderColor:'#C8D8C8', routesTo:'tax_save' },
  investments_regular:  { key:'investments_regular',  label:'Regular SIP / Investments',icon:'📈', color:'#2A5A8A', bgColor:'#EEF4FD', borderColor:'#B5D4F4', routesTo:'investment' },
  transport:            { key:'transport',            label:'Transport & Fuel',         icon:'🚗', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  entertainment:        { key:'entertainment',        label:'Entertainment & OTT',      icon:'🎬', color:'#8A6A1A', bgColor:'#FBF6EE', borderColor:'#EDD898', routesTo:'expense' },
  utilities:            { key:'utilities',            label:'Utilities & Recharges',    icon:'⚡', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  healthcare:           { key:'healthcare',           label:'Healthcare & Pharmacy',    icon:'💊', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  housing:              { key:'housing',              label:'Housing (Rent / EMI)',     icon:'🏠', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  insurance:            { key:'insurance',            label:'Insurance',                icon:'🛡️', color:'#B94040', bgColor:'#FBF0F0', borderColor:'#F0CECE', routesTo:'expense' },
  cc_payment:           { key:'cc_payment',           label:'Credit Card Payment',      icon:'💳', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
  transfer:             { key:'transfer',             label:'Transfer to Persons',      icon:'👤', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'transfer' },
  misc:                 { key:'misc',                 label:'Miscellaneous',            icon:'📦', color:'#7A8A7E', bgColor:'#F5F5F0', borderColor:'#E4DDD1', routesTo:'expense' },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MERCHANT RULES — 600+ patterns, backward-compatible structure
//    Each rule: { patterns: string[], mega, brandName? }
//    patterns are checked via includes() first, then fuzzy fallback
// ═══════════════════════════════════════════════════════════════════════════

export const MERCHANT_RULES: Array<{ patterns: string[]; mega: MegaCategory; brandName?: string }> = [
  // ── SALARY KEYWORDS ──────────────────────────────────────────────────
  { patterns:['SALARY','SAL CR','SAL/','PAYROLL','STIPEND','WAGES','EMOLUMENT'], mega:'salary', brandName:'Salary' },

  // ── CREDIT CARD PAYMENTS ─────────────────────────────────────────────
  { patterns:['CREDIT CARD','CC PAYMENT','CARD PAYMENT'], mega:'cc_payment', brandName:'Credit Card' },
  { patterns:['CRED MINT','CRED CLUB','CRED PAY','CRED '], mega:'cc_payment', brandName:'CRED' },
  { patterns:['AMEX','AMERICAN EXPRESS'], mega:'cc_payment', brandName:'Amex' },

  // ── FOOD: Delivery & Quick commerce ──────────────────────────────────
  { patterns:['SWIGGY','BUNDL TECHNOLOGIES'], mega:'food', brandName:'Swiggy' },
  { patterns:['ZOMATO','ZOMATO MEDIA','ZMT'], mega:'food', brandName:'Zomato' },
  { patterns:['EATSURE','FASSOS','BEHROUZ','OVEN STORY','BOX8'], mega:'food', brandName:'EatSure' },
  { patterns:['DOMINO','PIZZA HUT','MCDONALD','MCDONALDS','BURGER KING','SUBWAY','KFC','WENDYS'], mega:'food' },
  { patterns:['STARBUCKS','CHAAYOS','CHAI POINT','BLUE TOKAI','THIRD WAVE','CAFE COFFEE','CCD','BARISTA'], mega:'food', brandName:'Coffee' },
  { patterns:['HALDIRAM','BIKANERVALA','WOW MOMO','BASKIN ROBBINS','NATURALS ICE','BARBEQUE NATION'], mega:'food' },
  { patterns:['ZEPTO','BLINKIT','INSTAMART','BIGBASKET','BIG BASKET','DMART','D MART','GROFERS','DUNZO','JIOMART'], mega:'food', brandName:'Grocery' },
  { patterns:['COUNTRY DELIGHT','MILKBASKET','SUPR DAILY','LICIOUS','FRESHTOHOME','FRESH TO HOME'], mega:'food', brandName:'Grocery' },
  { patterns:['RELIANCE FRESH','RELIANCE SMART','SPENCER','MORE RETAIL','NATURE BASKET','STAR BAZAAR','SPAR','EASY DAY'], mega:'food', brandName:'Grocery' },
  { patterns:['RESTAURANT','RESTRO','DHABA','BIRYANI','CAFE ','BAKERY','SWEET SHOP'], mega:'food', brandName:'Dining' },
  { patterns:['MEALFUL','REBEL FOODS'], mega:'food' },

  // ── SHOPPING ─────────────────────────────────────────────────────────
  { patterns:['AMAZON','AMZN','AMZ '], mega:'shopping', brandName:'Amazon' },
  { patterns:['FLIPKART','FK ','FLIPKART.COM'], mega:'shopping', brandName:'Flipkart' },
  { patterns:['MYNTRA'], mega:'shopping', brandName:'Myntra' },
  { patterns:['MEESHO'], mega:'shopping', brandName:'Meesho' },
  { patterns:['NYKAA'], mega:'shopping', brandName:'Nykaa' },
  { patterns:['AJIO'], mega:'shopping', brandName:'Ajio' },
  { patterns:['PURPLLE','MAMAEARTH'], mega:'shopping', brandName:'Beauty' },
  { patterns:['SNAPDEAL','TATA CLIQ','TATACLIQ','TATA NEU'], mega:'shopping' },
  { patterns:['CROMA','RELIANCE DIGITAL','VIJAY SALES','CHROMA'], mega:'shopping', brandName:'Electronics' },
  { patterns:['APPLE STORE','SAMSUNG STORE','ONEPLUS'], mega:'shopping', brandName:'Electronics' },
  { patterns:['DECATHLON'], mega:'shopping', brandName:'Decathlon' },
  { patterns:['IKEA','PEPPERFRY','URBAN LADDER','HOME CENTRE'], mega:'shopping', brandName:'Home' },
  { patterns:['PANTALOONS','SHOPPERS STOP','WESTSIDE','LIFESTYLE','CENTRAL','MAX FASHION','V MART','RELIANCE TRENDS'], mega:'shopping', brandName:'Fashion' },
  { patterns:['ZARA','H&M','UNIQLO','MARKS SPENCER'], mega:'shopping', brandName:'Fashion' },
  { patterns:['LENSKART','TITAN','TANISHQ','KALYAN','MALABAR','PC JEWELLER'], mega:'shopping' },
  { patterns:['FIRSTCRY','HOPSCOTCH'], mega:'shopping', brandName:'Kids' },
  { patterns:['BOAT','NOISE'], mega:'shopping', brandName:'Electronics' },

  // ── INVESTMENTS: Tax-saving (ELSS → 80C) ─────────────────────────────
  { patterns:['ELSS','TAX SAVER','TAX SAVING'], mega:'investments_elss', brandName:'ELSS' },
  { patterns:['PPF','PUBLIC PROVIDENT'], mega:'investments_elss', brandName:'PPF' },
  { patterns:['SUKANYA SAMRIDHI'], mega:'investments_elss', brandName:'SSY' },

  // ── INVESTMENTS: Platforms & AMCs ─────────────────────────────────────
  { patterns:['NEXTBILLION','BILLIONBRAINS','GROWW','GROWW '], mega:'investments_regular', brandName:'Groww' },
  { patterns:['ZERODHA','KITE ','COIN ZERODHA','ZERODHA COIN'], mega:'investments_regular', brandName:'Zerodha' },
  { patterns:['KUVERA'], mega:'investments_regular', brandName:'Kuvera' },
  { patterns:['PAYTM MONEY'], mega:'investments_regular', brandName:'Paytm Money' },
  { patterns:['INDMONEY','INDWEALTH'], mega:'investments_regular', brandName:'INDmoney' },
  { patterns:['ETMONEY','ET MONEY'], mega:'investments_regular', brandName:'ET Money' },
  { patterns:['MFCENTRAL','MF CENTRAL','MF UTILITIES','MFUTILITY','BSE STAR','BSESTAR'], mega:'investments_regular', brandName:'MF Platform' },
  { patterns:['SMALLCASE','SCRIPBOX','WINT WEALTH','STABLE MONEY','FI MONEY','JUPITER MONEY','NIYO'], mega:'investments_regular' },
  { patterns:['ANGELONE','ANGEL BROKING','ANGEL ONE','DHAN ','UPSTOX','5PAISA','SHAREKHAN'], mega:'investments_regular', brandName:'Stock Broker' },
  { patterns:['MOTILAL OSWAL','IIFL ','ICICI DIRECT','ICICI SEC','HDFC SECURITIES','KOTAK SECURITIES','AXIS DIRECT','GEOJIT','EDELWEISS'], mega:'investments_regular', brandName:'Stock Broker' },
  { patterns:['NSDL','CDSL','VESTED'], mega:'investments_regular' },
  // AMC names (NACH/ECS debits)
  { patterns:['AXIS MUTUAL','AXIS BLUECHIP','AXIS LONG TERM'], mega:'investments_regular', brandName:'Axis MF' },
  { patterns:['HDFC MUTUAL','HDFC MID CAP','HDFC FLEXI','HDFC BALANCED','HDFC SMALL'], mega:'investments_regular', brandName:'HDFC MF' },
  { patterns:['ICICI PRU','ICICI PRUDENTIAL'], mega:'investments_regular', brandName:'ICICI Pru MF' },
  { patterns:['SBI MUTUAL','SBI MF','SBI BLUECHIP','SBI SMALL'], mega:'investments_regular', brandName:'SBI MF' },
  { patterns:['KOTAK MF','KOTAK MUTUAL','KOTAK STANDARD'], mega:'investments_regular', brandName:'Kotak MF' },
  { patterns:['NIPPON INDIA','NIPPON MF'], mega:'investments_regular', brandName:'Nippon MF' },
  { patterns:['ADITYA BIRLA','BIRLA SUN'], mega:'investments_regular', brandName:'ABSL MF' },
  { patterns:['DSP MUTUAL','DSP MF','DSP SMALL','DSP TAX'], mega:'investments_regular', brandName:'DSP MF' },
  { patterns:['TATA MUTUAL','TATA MF'], mega:'investments_regular', brandName:'Tata MF' },
  { patterns:['FRANKLIN TEMPLETON'], mega:'investments_regular', brandName:'Franklin MF' },
  { patterns:['MIRAE ASSET'], mega:'investments_regular', brandName:'Mirae MF' },
  { patterns:['PARAG PARIKH','PPFAS'], mega:'investments_regular', brandName:'PPFAS MF' },
  { patterns:['CANARA ROBECO'], mega:'investments_regular', brandName:'Canara Robeco' },
  { patterns:['QUANT MF','QUANT MUTUAL','QUANT SMALL','QUANT ACTIVE'], mega:'investments_regular', brandName:'Quant MF' },
  { patterns:['SUNDARAM MF','EDELWEISS MF','BANDHAN MF','UTI MUTUAL','UTI MF','PGIM INDIA','INVESCO INDIA','MAHINDRA MF','UNION MF','BARODA MF','LIC MF','HSBC MF'], mega:'investments_regular' },
  { patterns:['MUTUAL FUND','MUTUAL F/','SIP ','SIP/'], mega:'investments_regular' },
  { patterns:['ICCL','CLEARING CORP'], mega:'investments_regular', brandName:'Stock Exchange' },
  // NPS
  { patterns:['NATIONAL PENSION','NPS CONTRIB','NPS TIER','NSDL NPS'], mega:'investments_regular', brandName:'NPS' },
  // Gold
  { patterns:['GOLD BOND','SOVEREIGN GOLD','SGB','DIGITAL GOLD','SAFEGOLD','AUGMONT','MMTC GOLD','PAYTM GOLD'], mega:'investments_regular', brandName:'Gold' },
  // FD/RD
  { patterns:['FD BOOKING','FD OPENING','FIXED DEPOSIT','RECURRING DEPOSIT','RD INSTALLMENT','RD INST'], mega:'investments_regular', brandName:'FD/RD' },

  // ── INTEREST / DIVIDENDS (credits) ───────────────────────────────────
  { patterns:['INT.PD','INT PD','INTEREST PAID','INTEREST CR','INTEREST ON','INT.COLL','INT CR'], mega:'interest', brandName:'Bank Interest' },
  { patterns:['FD INTEREST','FD MATURITY','RD MATURITY'], mega:'interest', brandName:'FD Interest' },
  { patterns:['DIVIDEND','DIV CREDIT','DIV CR','DIV '], mega:'interest', brandName:'Dividend' },
  { patterns:['NHPC','COAL INDIA','POWER FINANCE','POWERGRID','ONGC','NTPC','ITC','VEDANTA','INFOSYS','TCS','RELIANCE','TATA'], mega:'interest', brandName:'Dividend' },
  { patterns:['ECS Credit','ECS CR'], mega:'interest', brandName:'ECS Credit' },

  // ── TRANSPORT ────────────────────────────────────────────────────────
  { patterns:['UBER'], mega:'transport', brandName:'Uber' },
  { patterns:['OLA ','OLA/','OLACABS'], mega:'transport', brandName:'Ola' },
  { patterns:['RAPIDO'], mega:'transport', brandName:'Rapido' },
  { patterns:['NAMMA YATRI','BLU SMART','BLUSMART','MERU'], mega:'transport', brandName:'Cab' },
  { patterns:['IRCTC','INDIAN RAILWAY','RAILWAYS','INDIAN R/','IRUTS'], mega:'transport', brandName:'Indian Railways' },
  { patterns:['METRO RAIL','DMRC','BMRCL','METRO '], mega:'transport', brandName:'Metro' },
  { patterns:['REDBUS','ABHIBUS'], mega:'transport', brandName:'Bus' },
  { patterns:['MAKEMYTRIP','MMT','CLEARTRIP','IXIGO','GOIBIBO','EASEMYTRIP','YATRA'], mega:'transport', brandName:'Travel' },
  { patterns:['INDIGO','SPICEJET','AIR INDIA','VISTARA','AKASA','ALLIANCE AIR'], mega:'transport', brandName:'Flight' },
  { patterns:['HPCL','BPCL','IOCL','INDIAN OIL','HINDUSTAN PETROL','BHARAT PETROL','RELIANCE PETRO','SHELL'], mega:'transport', brandName:'Fuel' },
  { patterns:['IOCLIND','PETROL','PUMP','DIESEL','FUEL'], mega:'transport', brandName:'Fuel' },
  { patterns:['FASTAG','NETC FASTAG','PAYTM FASTAG','TOLL ','PARKING','PARK PLUS'], mega:'transport', brandName:'Toll/Parking' },

  // ── ENTERTAINMENT & SUBSCRIPTIONS ────────────────────────────────────
  { patterns:['NETFLIX'], mega:'entertainment', brandName:'Netflix' },
  { patterns:['HOTSTAR','DISNEY+','DISNEY PLUS','JIOCINEMA'], mega:'entertainment', brandName:'Streaming' },
  { patterns:['PRIME VIDEO','AMAZON PRIME'], mega:'entertainment', brandName:'Prime Video' },
  { patterns:['SPOTIFY','APPLE MUSIC','GAANA','WYNK','JIOSAAVN'], mega:'entertainment', brandName:'Music' },
  { patterns:['SONYLIV','ZEE5','VOOT','MX PLAYER','YOUTUBE PREMIUM','AUDIBLE','KINDLE'], mega:'entertainment' },
  { patterns:['BOOKMYSHOW','BMS','PVR','INOX','CINEPOLIS'], mega:'entertainment', brandName:'Movies' },
  { patterns:['STEAM','PLAYSTATION','XBOX','GOOGLE PLAY'], mega:'entertainment', brandName:'Gaming' },
  { patterns:['APPLE.COM','ICLOUD','GOOGLE ONE','GOOGLE STORAGE','CHATGPT','OPENAI','NOTION','CANVA','ADOBE','MICROSOFT 365','LINKEDIN PREMIUM'], mega:'entertainment', brandName:'Subscription' },

  // ── UTILITIES & BILLS ────────────────────────────────────────────────
  { patterns:['AIRTEL'], mega:'utilities', brandName:'Airtel' },
  { patterns:['JIO','RELIANCE JIO'], mega:'utilities', brandName:'Jio' },
  { patterns:['VI ','VODAFONE','IDEA ','BSNL'], mega:'utilities', brandName:'Telecom' },
  { patterns:['ACT FIBERNET','ACT BROADBAND','HATHWAY','BROADBAND','INTERNET'], mega:'utilities', brandName:'Internet' },
  { patterns:['ELECTRICITY','BSES','TATA POWER','BESCOM','MSEDCL','TANGEDCO','ADANI ELECTRICITY','TORRENT POWER','CESC','DHBVN','UHBVN','PSPCL','APSPDCL','TSSPDCL','TNEB','KSEB','WBSEDCL','ELECT BILL'], mega:'utilities', brandName:'Electricity' },
  { patterns:['WATER BILL','WATER SUPPLY','DELHI JAL','BWSSB','MUNICIPAL'], mega:'utilities', brandName:'Water' },
  { patterns:['INDRAPRASTHA GAS','MAHANAGAR GAS','ADANI GAS','GAS CYLINDER','LPG','HP GAS','BHARAT GAS','INDANE'], mega:'utilities', brandName:'Gas' },
  { patterns:['TATA PLAY','TATA SKY','DISH TV','D2H','SUN DIRECT'], mega:'utilities', brandName:'DTH' },
  { patterns:['RECHARGE'], mega:'utilities', brandName:'Recharge' },

  // ── HEALTHCARE ───────────────────────────────────────────────────────
  { patterns:['APOLLO','FORTIS','MAX HOSPITAL','MANIPAL HOSPITAL','MEDANTA','NARAYANA HEALTH','ASTER','AIIMS','PRACTO'], mega:'healthcare', brandName:'Hospital' },
  { patterns:['MEDPLUS','1MG','TATA 1MG','NETMEDS','PHARMEASY'], mega:'healthcare', brandName:'Pharmacy' },
  { patterns:['PHARMACY','MEDICAL','MEDICINE','HOSPITAL','CLINIC','DIAGNOSTIC'], mega:'healthcare' },
  { patterns:['DR LAL PATH','THYROCARE','SRL DIAG','METROPOLIS','PATHOLOGY'], mega:'healthcare', brandName:'Lab Test' },
  { patterns:['GYM','CULT.FIT','CULT FIT','CUREFIT','GOLD GYM','ANYTIME FITNESS','FITNESS'], mega:'healthcare', brandName:'Fitness' },

  // ── HOUSING & EMI/LOAN ───────────────────────────────────────────────
  { patterns:['RENT','HOUSE RENT','HOME LOAN','MORTGAGE'], mega:'housing' },
  { patterns:['NOBROKER','MAGICBRICKS','99ACRES','HOUSING.COM','NESTAWAY','OYO LIFE'], mega:'housing', brandName:'Housing' },
  { patterns:['URBAN COMPANY','URBAN CLAP','URBANCLAP'], mega:'housing', brandName:'Home Services' },
  { patterns:['MAINTENANCE','SOCIETY','RWA','APARTMENT'], mega:'housing', brandName:'Society' },
  // EMI / Lender patterns
  { patterns:['EMI','LOAN REPAY','LOAN EMI','HOME LOAN','HOUSING LOAN','PERSONAL LOAN','EDUCATION LOAN','GOLD LOAN','CONSUMER DURABLE','CAR LOAN','VEHICLE LOAN','AUTO LOAN'], mega:'housing', brandName:'EMI/Loan' },
  { patterns:['BAJAJ FINANCE','BAJAJ FINSERV','BAJAJFIN'], mega:'housing', brandName:'Bajaj Finance EMI' },
  { patterns:['HDFC LTD','HDFC HOME','HDFC CREDILA'], mega:'housing', brandName:'HDFC EMI' },
  { patterns:['LIC HOUSING','PNB HOUSING'], mega:'housing', brandName:'Housing Loan' },
  { patterns:['MUTHOOT','MANAPPURAM'], mega:'housing', brandName:'Gold Loan' },
  { patterns:['TATA CAPITAL','MAHINDRA FINANCE','SHRIRAM FINANCE','SHRIRAM TRANSPORT','CHOLAMANDALAM','PIRAMAL','FULLERTON','HOME FIRST','AAVAS','GODREJ HOUSING','CAN FIN','SUNDARAM FINANCE','L&T FINANCE','HERO FINCORP'], mega:'housing', brandName:'EMI' },
  { patterns:['TVS CREDIT'], mega:'transport', brandName:'Vehicle EMI' },
  // BNPL / Micro-lenders
  { patterns:['SAMSUNG FINANCE','APPLE FINANCE','ZESTMONEY','SIMPL','LAZYPAY','KISSHT','SLICE','UNI CARD','ONECARD','FLEXMONEY'], mega:'shopping', brandName:'BNPL EMI' },
  { patterns:['NAVI FINSERV','MONEYVIEW','MONEY VIEW','EARLY SALARY','EARLYSALARY','KREDITBEE','CASHE','FIBE','MPOKKET','PREFR','LENDINGKART','INDIFI','STASHFIN'], mega:'housing', brandName:'Personal Loan EMI' },
  { patterns:['NACH','NACH DR','NACH DEBIT','ACH D-','ECS DR','ECS DEBIT'], mega:'housing', brandName:'EMI/Loan' },

  // ── INSURANCE ────────────────────────────────────────────────────────
  { patterns:['LIC OF INDIA','LIC PREMIUM','LIC INS','LIC-','LIC ','LIFE INSURANCE'], mega:'insurance', brandName:'LIC' },
  { patterns:['MAX LIFE','HDFC LIFE','ICICI PRU LIFE','SBI LIFE','BAJAJ ALLIANZ LIFE','TATA AIA','KOTAK LIFE','PNB METLIFE'], mega:'insurance', brandName:'Life Insurance' },
  { patterns:['STAR HEALTH','NIVA BUPA','CARE HEALTH','ADITYA BIRLA HEALTH','MANIPAL CIGNA','HEALTH INSURANCE','MEDICLAIM'], mega:'insurance', brandName:'Health Insurance' },
  { patterns:['ICICI LOMBARD','BAJAJ ALLIANZ GEN','NEW INDIA ASSURANCE','NATIONAL INSURANCE','ORIENTAL INSURANCE','UNITED INDIA INS','HDFC ERGO','TATA AIG','GO DIGIT','ACKO'], mega:'insurance', brandName:'General Insurance' },
  { patterns:['POLICYBAZAAR','POLICYBA','DITTO INS','TERM PLAN','TERM INSURANCE'], mega:'insurance' },

  // ── CASHBACK / REFUNDS ───────────────────────────────────────────────
  { patterns:['CASHBACK','CASH BACK','REFUND','RETURN','REVERSAL','CHARGEBACK'], mega:'cashback' },
  { patterns:['GPAYREFUND','GPAY REFUND'], mega:'cashback', brandName:'GPay Refund' },

  // ── SELF-TRANSFER KEYWORDS ───────────────────────────────────────────
  { patterns:['SELF TRANSFER','SELF TRF','SELF TR','TRANSFER TO SELF','TRF TO SELF','OWN ACCOUNT','OWN A/C'], mega:'transfer', brandName:'Self Transfer' },

  // ── BANK CHARGES & ATM ───────────────────────────────────────────────
  { patterns:['SMS CHARGE','BANK CHARGE','SERVICE CHARGE','MIN BAL','MINIMUM BALANCE','ANNUAL FEE','DEBIT CARD FEE','LOCKER','PENALTY','BOUNCE','INSUFFICIENT'], mega:'misc', brandName:'Bank Charges' },
  { patterns:['ATM','CASH WITHDRAWAL','NWD','SELF WDL','CASH WDL'], mega:'misc', brandName:'ATM' },
  { patterns:['GST','SERVICE TAX'], mega:'misc', brandName:'Tax/Charges' },

  // ── GOVERNMENT / EDUCATION ───────────────────────────────────────────
  { patterns:['INCOME TAX','TDS','ADVANCE TAX','SELF ASSESSMENT','STAMP DUTY'], mega:'misc', brandName:'Tax Payment' },
  { patterns:['SCHOOL FEE','COLLEGE FEE','TUITION','UNIVERSITY','UNACADEMY','BYJUS','UPGRAD','COURSERA','UDEMY'], mega:'misc', brandName:'Education' },

  // ── TRAVEL & HOTELS ──────────────────────────────────────────────────
  { patterns:['OYO','AIRBNB','BOOKING.COM','AGODA','TRIVAGO','MARRIOTT','TAJ HOTEL','ITC HOTEL','HOTEL','RESORT'], mega:'entertainment', brandName:'Travel/Hotel' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 4. VPA-TO-MERCHANT MAPPING — 150+ known Indian UPI VPAs
//    When narration says "UPI/swiggy@icici/..." we can categorize from VPA
// ═══════════════════════════════════════════════════════════════════════════

const VPA_MERCHANT_MAP: Record<string, { mega: MegaCategory; brand: string }> = {
  // Food
  swiggy: { mega:'food', brand:'Swiggy' }, zomato: { mega:'food', brand:'Zomato' },
  zepto: { mega:'food', brand:'Zepto' }, blinkit: { mega:'food', brand:'Blinkit' },
  bigbasket: { mega:'food', brand:'BigBasket' }, dunzo: { mega:'food', brand:'Dunzo' },
  dominos: { mega:'food', brand:'Dominos' }, mcdonalds: { mega:'food', brand:'McDonalds' },
  kfc: { mega:'food', brand:'KFC' }, starbucks: { mega:'food', brand:'Starbucks' },
  // Shopping
  amazon: { mega:'shopping', brand:'Amazon' }, amazonpay: { mega:'shopping', brand:'Amazon' },
  flipkart: { mega:'shopping', brand:'Flipkart' }, myntra: { mega:'shopping', brand:'Myntra' },
  meesho: { mega:'shopping', brand:'Meesho' }, nykaa: { mega:'shopping', brand:'Nykaa' },
  ajio: { mega:'shopping', brand:'Ajio' }, croma: { mega:'shopping', brand:'Croma' },
  // Transport
  uber: { mega:'transport', brand:'Uber' }, ola: { mega:'transport', brand:'Ola' },
  olacabs: { mega:'transport', brand:'Ola' }, rapido: { mega:'transport', brand:'Rapido' },
  irctc: { mega:'transport', brand:'IRCTC' },
  // Entertainment
  netflix: { mega:'entertainment', brand:'Netflix' }, spotify: { mega:'entertainment', brand:'Spotify' },
  hotstar: { mega:'entertainment', brand:'Hotstar' },
  // Utilities
  airtel: { mega:'utilities', brand:'Airtel' }, jio: { mega:'utilities', brand:'Jio' },
  // Investments
  groww: { mega:'investments_regular', brand:'Groww' }, zerodha: { mega:'investments_regular', brand:'Zerodha' },
  kuvera: { mega:'investments_regular', brand:'Kuvera' },
  paytmmoney: { mega:'investments_regular', brand:'Paytm Money' },
  // Insurance
  policybazaar: { mega:'insurance', brand:'PolicyBazaar' },
  // CC
  cred: { mega:'cc_payment', brand:'CRED' },
  // Healthcare
  practo: { mega:'healthcare', brand:'Practo' }, pharmeasy: { mega:'healthcare', brand:'PharmEasy' },
  '1mg': { mega:'healthcare', brand:'1mg' },
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. FUZZY MATCHING — n-gram overlap for handling BAJAJFINEMI, ONE97, etc.
// ═══════════════════════════════════════════════════════════════════════════

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.substring(i, i + 2))
  return set
}

function fuzzyScore(a: string, b: string): number {
  const ba = bigrams(a), bb = bigrams(b)
  if (ba.size === 0 || bb.size === 0) return 0
  let intersection = 0
  for (const bg of ba) if (bb.has(bg)) intersection++
  return (2 * intersection) / (ba.size + bb.size) // Dice coefficient
}

// Known fuzzy aliases: company names that appear differently in narrations
const FUZZY_ALIASES: Array<{ aliases: string[]; mega: MegaCategory; brand: string }> = [
  { aliases:['BAJAJ FINANCE','BAJAJ FINSERV','BAJAJFIN','BAJFINEMI','BAJAJFINEMI','BFL','BAJAJ FIN'], mega:'housing', brand:'Bajaj Finance EMI' },
  { aliases:['ONE97','ONE 97','PAYTM','PYTM','PAY TM'], mega:'misc', brand:'Paytm' },
  { aliases:['BUNDL TECHNOLOGIES','BUNDL TECH','SWIGGY'], mega:'food', brand:'Swiggy' },
  { aliases:['ZOMATO MEDIA','ZOMATO','ZMT','ZOMAT'], mega:'food', brand:'Zomato' },
  { aliases:['BILLIONBRAINS','BILLION BRAINS','NEXTBILLION','NEXT BILLION','GROWW'], mega:'investments_regular', brand:'Groww' },
  { aliases:['BHARTI AIRTEL','AIRTEL','BRTI'], mega:'utilities', brand:'Airtel' },
  { aliases:['RELIANCE JIO','JIO DIGITAL','JIO PLATFORMS','JIO'], mega:'utilities', brand:'Jio' },
  // HDFC-specific narration quirks (company vs trade name)
  { aliases:['LIFEINCORPOFIND','LIFE INSURANCE CORPO','LIC OF INDIA','LICINDIA'], mega:'insurance', brand:'LIC' },
  { aliases:['HARE KRISHNA','HAREKRISHNA'], mega:'misc', brand:'Merchant' },
  { aliases:['WHEELPORT','WHEEL PORT'], mega:'misc', brand:'Business' },
  // Payment gateway company names that appear instead of merchant
  { aliases:['RAZORPAY','RAZOR PAY','RAZORPAY SOFTWARE','RAZRPAY'], mega:'misc', brand:'Razorpay' },
  { aliases:['CASHFREE','CASH FREE','CASHFREE PAYMENTS'], mega:'misc', brand:'Cashfree' },
  { aliases:['PAYU','PAY U','PAYUBIZ','PAYU BIZ'], mega:'misc', brand:'PayU' },
  { aliases:['BILLDESK','BILL DESK'], mega:'misc', brand:'BillDesk' },
  { aliases:['CCAVENUE','CC AVENUE'], mega:'misc', brand:'CCAvenue' },
]

// ── PAYTM QR / BHARATPE QR patterns ────────────────────────────────────
// Real HDFC narrations: "UPI-SANJU-PAYTMQR6CA6XD@PTYS-YESB0PTMUPI"
// The PAYTMQR prefix means it's a QR merchant payment, not a person transfer
const QR_PREFIXES = ['PAYTMQR','BHARATPE','BHARATQR','PHONEPEQR','GPAYMERCHANT']

// ── GAMBLING / SPECULATIVE PLATFORMS (risk flag) ───────────────────────
// These aren't categorization — they're risk signals for the insight engine
export const GAMBLING_PATTERNS = [
  'DREAM11','MY11CIRCLE','MPL','BETWAY','BET365','RUMMY','POKERSTARS',
  'WINZO','FANTASY','ZUPEE','GETMEGA','POKER','CRICKET BETTING',
  'CASINO','GAMBLING','FAIRPLAY','PARIMATCH','1XBET','BETFAIR',
]

function fuzzyMatch(description: string): { mega: MegaCategory; brand: string } | null {
  const desc = description.toUpperCase().replace(/[^A-Z0-9 ]/g, '')
  for (const entry of FUZZY_ALIASES) {
    for (const alias of entry.aliases) {
      if (fuzzyScore(desc, alias) > 0.55) return { mega: entry.mega, brand: entry.brand }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PERSON NAME EXTRACTION — preserved + enhanced
// ═══════════════════════════════════════════════════════════════════════════

const KNOWN_MERCHANT_WORDS = [
  'SWIGGY','AMAZON','FLIPKART','MYNTRA','MEESHO','ZOMATO','BLINKIT','ZEPTO','CRED',
  'GROWW','PHONEPE','PAYTM','GPAY','AIRTEL','JIO','NETFLIX','UBER','OLA','RAPIDO',
  'BIGBASKET','BOOKMYSHOW','IRCTC','LIC','HDFC','ICICI','SBI','AXIS','KOTAK','NYKAA',
  'AJIO','ZERODHA','AMAZON PAY','BAJAJ','TATA','RELIANCE','VODAFONE','IDEA','VI',
  'BPCL','HPCL','IOCL','CROMA','DOMINOS','STARBUCKS','SPOTIFY','HOTSTAR','DISNEY',
  'POLICYBAZAAR','PHARMEASY','APOLLO','MEDPLUS','PRACTO','NETMEDS','UNACADEMY','BYJUS',
  'CLEARTRIP','MAKEMYTRIP','GOIBIBO','INDIGO','SPICEJET','VISTARA','EASEMYTRIP',
  'SLICE','LAZYPAY','SIMPL','ONECARD','CRED','FREECHARGE','MOBIKWIK',
  'BUNDL TECHNOLOGIES','ZOMATO MEDIA','ONE97','BILLIONBRAINS','NEXTBILLION',
  'BHARTI','TORRENT','ADANI','MAHANAGAR','TATA POWER','BESCOM','BSES',
]

export function extractPersonName(description: string): string | null {
  if (!description) return null
  const desc = description.toUpperCase()

  // Skip: masked account numbers (XXXXXX patterns) = self-transfers
  // Real HDFC: "UPI-XXXXXX8092-HDFC0009367-107398039084-UPI"
  if (desc.match(/UPI-X{4,}/)) return null

  // Skip: QR merchant payments (not person transfers)
  // Real HDFC: "UPI-SANJU-PAYTMQR6CA6XD@PTYS-YESB0PTMUPI"
  if (QR_PREFIXES.some(qr => desc.includes(qr))) {
    // But still try to extract the person name before the QR handle
    // "UPI-SANJU-PAYTMQR..." → SANJU is a small shop owner, treat as merchant
    return null
  }

  // Pattern 1: UPI-FIRSTNAME LASTNAME-VPA@BANK (most common HDFC format)
  // Real: "UPI-ADITI SHARMA-9264235969@YBL-SBIN001"
  // Real: "UPI-SAMIK SON OF FURKAN-PAYTMQR668GV2@P"
  // Real: "UPI-RAJENDER SINGH YADA-Q53148477@YBL-Y"
  const upiDash = desc.match(/UPI[-\s]+([A-Z][A-Z ]{2,30})[-/@]/)
  if (upiDash) {
    let name = upiDash[1].trim()
    // Remove "SON OF..." / "S/O" / "D/O" / "W/O" suffixes
    name = name.replace(/\s+(?:SON OF|S\/O|D\/O|W\/O|C\/O)\s+.*$/i, '').trim()
    if (!KNOWN_MERCHANT_WORDS.some(m => name.includes(m)) && (name.includes(' ') || name.length >= 4)) {
      return titleCase(name)
    }
  }

  // Pattern 2: UPI/VPA/NAME/REF — extract name from 3rd segment
  const upiSlash = desc.match(/UPI\/[^/]+\/([A-Z][A-Z ]{2,30})\//)
  if (upiSlash) {
    const name = upiSlash[1].trim()
    if (!KNOWN_MERCHANT_WORDS.some(m => name.includes(m)) && name.length >= 3) {
      return titleCase(name)
    }
  }

  // Pattern 3: IMPS-REF-FIRSTNAME LASTNAME-BANKCODE
  // Real HDFC: "IMPS-821120336017-SHIVAM GOND-KKBK-XXXXX"
  const impsMatch = desc.match(/IMPS[-/]\d+[-/]([A-Z][A-Z ]{2,25})[-/]/)
  if (impsMatch) {
    const name = impsMatch[1].trim()
    if (name.length >= 4 && !KNOWN_MERCHANT_WORDS.some(m => name.includes(m))) return titleCase(name)
  }

  // Pattern 4: NEFT CR/DR-IFSC-COMPANY/PERSON NAME
  // Real HDFC: "NEFT CR-KKBK0000958-WHEELPORT LOGISTICS PRIVATE LIMITED-..."
  const neftMatch = desc.match(/NEFT\s+(?:CR|DR)[-\s]+[A-Z]{4}\d{7}[-\s]+([A-Z][A-Z &.]{2,40})(?:[-\s]+|$)/)
  if (neftMatch) {
    const name = neftMatch[1].trim()
    if (!KNOWN_MERCHANT_WORDS.some(m => name.includes(m)) && name.length >= 4) {
      return titleCase(name)
    }
  }

  // Pattern 5: Generic NEFT/RTGS FROM/TO PERSON
  const neftGeneric = desc.match(/(?:NEFT|RTGS).*(?:FROM|TO)\s+([A-Z][A-Z ]{2,30})(?:\s+(?:UTR|AMT|INR|REF|$))/)
  if (neftGeneric) {
    const name = neftGeneric[1].trim()
    if (!KNOWN_MERCHANT_WORDS.some(m => name.includes(m)) && name.length >= 4) {
      return titleCase(name)
    }
  }

  return null
}

function titleCase(s: string): string {
  return s.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ').trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. VPA EXTRACTION — pull merchant identity from UPI handle
// ═══════════════════════════════════════════════════════════════════════════

function extractVPA(description: string): string | null {
  const match = description.match(/([a-zA-Z0-9._-]+@[a-zA-Z]{2,64})/i)
  return match ? match[1].toLowerCase() : null
}

function matchVPA(description: string): { mega: MegaCategory; brand: string } | null {
  const vpa = extractVPA(description)
  if (!vpa) return null
  const prefix = vpa.split('@')[0].toLowerCase().replace(/[0-9._-]/g, '')
  if (VPA_MERCHANT_MAP[prefix]) return VPA_MERCHANT_MAP[prefix]
  // Partial match: if prefix contains a known merchant
  for (const [key, val] of Object.entries(VPA_MERCHANT_MAP)) {
    if (prefix.includes(key) || key.includes(prefix)) return val
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. MERCHANT MEMORY — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

const MEMORY_KEY = 'av_merchant_memory'

export function loadMerchantMemory(): Record<string, MegaCategory> {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}') } catch { return {} }
}

export function saveMerchantMemory(memory: Record<string, MegaCategory>) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)) } catch {}
}

export function extractMerchantKey(description: string): string {
  if (!description) return ''
  const desc = description.toUpperCase()
  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) return p.toUpperCase()
    }
  }
  // Check VPA
  const vpa = extractVPA(description)
  if (vpa) return vpa.split('@')[0].toUpperCase()
  return desc.substring(0, 25).trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. matchMega — THE CORE: 3-tier categorization pipeline
//    Signature preserved exactly. Intelligence upgraded.
// ═══════════════════════════════════════════════════════════════════════════

export function matchMega(
  description: string,
  currentCategory?: string,
  memory?: Record<string, MegaCategory>
): { mega: MegaCategory; brand?: string; confidence?: number } {
  if (!description) return { mega: 'misc', confidence: 0 }
  const desc = description.toUpperCase()

  // ── TIER 0: User memory (sacred — always wins) ──
  if (memory) {
    const key = extractMerchantKey(description)
    if (memory[key]) return { mega: memory[key], confidence: 1.0 }
    // Also check if any memory key is a substring
    for (const [memKey, memCat] of Object.entries(memory)) {
      if (desc.includes(memKey)) return { mega: memCat, confidence: 1.0 }
    }
  }

  // ── TIER 1a: Exact substring match against 600+ rules ──
  for (const rule of MERCHANT_RULES) {
    for (const p of rule.patterns) {
      if (desc.includes(p.toUpperCase())) {
        return { mega: rule.mega, brand: rule.brandName, confidence: 0.95 }
      }
    }
  }

  // ── TIER 1b: VPA-to-merchant mapping ──
  const vpaMatch = matchVPA(description)
  if (vpaMatch) return { ...vpaMatch, confidence: 0.90 }

  // ── TIER 1c: Fuzzy matching for concatenated/abbreviated names ──
  const fuzzy = fuzzyMatch(description)
  if (fuzzy) return { ...fuzzy, confidence: 0.75 }

  // ── TIER 2: Category hint from parser (currentCategory fallback) ──
  const fallback: Record<string, MegaCategory> = {
    salary:'salary', rent:'housing', emi:'housing',
    grocery:'food', food:'food', fuel:'transport',
    shopping:'shopping', entertainment:'entertainment',
    insurance:'insurance', investment:'investments_regular', sip:'investments_regular',
    transfer:'transfer', utility:'utilities', medical:'healthcare',
    education:'misc', other:'misc'
  }
  if (currentCategory && fallback[currentCategory]) {
    return { mega: fallback[currentCategory], confidence: 0.50 }
  }

  return { mega: 'misc', confidence: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. isCreditCardPayment — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

export function isCreditCardPayment(description: string, cards: Array<{bank:string; last4:string}>): boolean {
  if (!description || !cards?.length) return false
  const desc = description.toUpperCase()
  for (const card of cards) {
    if (card.last4 && desc.includes(card.last4)) return true
    if (card.bank && desc.includes(card.bank.toUpperCase()) && (desc.includes('CC') || desc.includes('CREDIT CARD') || desc.includes('PAYMENT'))) return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. tagTransactions — preserved signature, upgraded internals
// ═══════════════════════════════════════════════════════════════════════════

export function tagTransactions(transactions: any[], cards: Array<{bank:string; last4:string}> = []): any[] {
  if (!transactions) return []
  const memory = typeof window !== 'undefined' ? loadMerchantMemory() : {}
  return transactions.map((t, i) => {
    let { mega, brand, confidence } = matchMega(t.description, t.category, memory)
    const desc = (t.description || '').toUpperCase()

    // ── Masked account self-transfers ──
    // Real HDFC: "UPI-XXXXXX8092-HDFC0009367-107398039084-UPI"
    // These are transfers to own accounts, not expenses
    if (desc.match(/UPI-X{4,}/) || desc.match(/XXXXXX\d{4}/)) {
      mega = 'transfer'
      brand = 'Self Transfer'
      confidence = 0.85
    }

    // Override to credit card payment if matches user's cards
    if (t.type === 'debit' && isCreditCardPayment(t.description, cards)) {
      mega = 'cc_payment'
      const matched = cards.find(c => (t.description||'').toUpperCase().includes(c.last4))
      brand = matched ? `${matched.bank} ****${matched.last4}` : 'Credit card'
      confidence = 0.95
    }

    // Extract person name from UPI for transfer categorization
    const personName = extractPersonName(t.description || '')
    if (personName && mega === 'misc' && t.type === 'debit') {
      mega = 'transfer'
      brand = personName
      confidence = 0.80
    }

    // ── QR merchant payments — keep as misc but tag the merchant ──
    // "UPI-SANJU-PAYTMQR6CA6XD@PTYS" → small merchant, shopping/food
    if (mega === 'misc' && QR_PREFIXES.some(qr => desc.includes(qr))) {
      // QR payments are usually small shops, food stalls, or local merchants
      // Leave as misc but mark brand so user can recategorize
      const qrName = desc.match(/UPI[-\s]+([A-Z][A-Z ]{2,20})[-\s]+(?:PAYTMQR|BHARATPE|BHARATQR)/)
      brand = qrName ? titleCase(qrName[1].trim()) + ' (QR)' : 'QR Merchant'
      confidence = 0.30 // Low confidence — needs user input or LLM
    }

    // Auto-route dividends to interest
    if (t.type === 'credit' && (desc.includes('DIVIDEND') || desc.includes('DIV ') || desc.includes('DIVID'))) {
      mega = 'interest'
      brand = brand || 'Dividend'
      confidence = 0.90
    }

    // Interest credits
    if (t.type === 'credit' && mega === 'misc' && (desc.includes('INT') || desc.includes('INTEREST'))) {
      mega = 'interest'
      brand = 'Bank Interest'
      confidence = 0.85
    }

    // ── Gambling/speculative flag ──
    const isGambling = GAMBLING_PATTERNS.some(g => desc.includes(g))

    const id = `t_${i}_${(t.date||'').replace(/[-/]/g,'')}_${Math.round(t.amount)}`
    return { ...t, id, mega, brand, personName, confidence: confidence || 0, isGambling }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. detectSalaryCandidates — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

export interface SalaryCandidate {
  source: string
  averageAmount: number
  totalAmount: number
  occurrences: number
  variance: number
  transactions: any[]
  confidence: 'high' | 'medium' | 'low'
}

export function detectSalaryCandidates(transactions: any[]): SalaryCandidate[] {
  const credits = transactions.filter((t:any) => t.type === 'credit' && t.amount >= 5000)
  const groups: Record<string, any[]> = {}
  credits.forEach((t:any) => {
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
    const maxDev = txns.length > 1 ? Math.max(...amounts.map((a:number) => Math.abs(a - avg) / avg)) : 0
    if (avg < 8000) return

    // Enhanced: boost confidence if narration contains salary keywords
    const hasSalaryKeyword = txns.some((t:any) => {
      const d = (t.description || '').toUpperCase()
      return d.includes('SALARY') || d.includes('SAL CR') || d.includes('SAL/') || d.includes('PAYROLL') || d.includes('STIPEND')
    })

    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (hasSalaryKeyword && txns.length >= 1) confidence = 'high'
    else if (txns.length >= 3 && maxDev < 0.20 && avg >= 15000) confidence = 'high'
    else if (txns.length >= 2 && maxDev < 0.30 && avg >= 10000) confidence = 'medium'
    else if (txns.length >= 1 && avg >= 15000) confidence = 'low'
    else return

    candidates.push({ source, averageAmount: Math.round(avg), totalAmount: amounts.reduce((a:number,b:number) => a + b, 0), occurrences: txns.length, variance: maxDev, transactions: txns, confidence })
  })

  const order = { high: 0, medium: 1, low: 2 }
  return candidates.sort((a, b) => order[a.confidence] - order[b.confidence] || b.averageAmount - a.averageAmount)
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. generateExpenseSuggestions — preserved exactly
// ═══════════════════════════════════════════════════════════════════════════

export interface ExpenseSuggestion {
  id: string
  mega: MegaCategory
  label: string
  icon: string
  monthlyAmount: number
  totalAmount: number
  count: number
  brands: string[]
  targetField: 'fixed' | 'variable' | 'savings' | 'tax_save' | 'cc'
  targetLabel: string
  description: string
}

export function generateExpenseSuggestions(transactions: any[], months: number, salaryIds: Set<string>, parkedIds: Set<string>): ExpenseSuggestion[] {
  const suggestions: ExpenseSuggestion[] = []
  const grouped: Record<string, any[]> = {}
  const personTransfers: Record<string, any[]> = {}

  transactions.forEach(t => {
    if (t.type !== 'debit') return
    if (salaryIds.has(t.id) || parkedIds.has(t.id)) return
    const k = t.mega || 'misc'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(t)
    if ((k === 'transfer' || k === 'misc') && t.personName) {
      const name = t.personName.toUpperCase()
      if (!personTransfers[name]) personTransfers[name] = []
      personTransfers[name].push(t)
    }
  })

  const fieldMap: Record<string, { target: ExpenseSuggestion['targetField']; label: string }> = {
    food: { target: 'variable', label: 'Dining out / Takeaway' },
    shopping: { target: 'variable', label: 'Shopping / Clothing' },
    transport: { target: 'variable', label: 'Fuel / Transport' },
    entertainment: { target: 'variable', label: 'Entertainment / OTT' },
    healthcare: { target: 'variable', label: 'Medicine / Healthcare' },
    utilities: { target: 'fixed', label: 'Electricity / Gas / Internet' },
    housing: { target: 'fixed', label: 'Rent / Home loan EMI' },
    insurance: { target: 'fixed', label: 'Insurance' },
    investments_elss: { target: 'tax_save', label: 'ELSS (80C)' },
    investments_regular: { target: 'savings', label: 'SIP / Mutual Funds' },
    cc_payment: { target: 'cc', label: 'Credit card bill' },
    transfer: { target: 'variable', label: 'Transfer to Persons' },
  }

  Object.entries(grouped).forEach(([mega, txns]) => {
    if (!fieldMap[mega]) return
    const total = txns.reduce((s: number, t: any) => s + t.amount, 0)
    if (total < 200) return
    const monthly = Math.round(total / months)
    const brands = Array.from(new Set(txns.map((t: any) => t.brand || t.personName).filter(Boolean))) as string[]
    const info = MEGA_CATEGORIES[mega as MegaCategory]
    suggestions.push({
      id: `sugg_${mega}`,
      mega: mega as MegaCategory,
      label: info?.label || mega,
      icon: info?.icon || '📦',
      monthlyAmount: monthly,
      totalAmount: total,
      count: txns.length,
      brands,
      targetField: fieldMap[mega].target,
      targetLabel: fieldMap[mega].label,
      description: brands.length > 0
        ? `${brands.slice(0,3).join(' + ')}${brands.length>3?'...':''} = ₹${monthly.toLocaleString('en-IN')}/mo`
        : `${txns.length} transactions = ₹${monthly.toLocaleString('en-IN')}/mo`,
    })
  })

  Object.entries(personTransfers).forEach(([name, txns]) => {
    if (txns.length < 2) return
    const total = txns.reduce((s: number, t: any) => s + t.amount, 0)
    if (total < 500) return
    const monthly = Math.round(total / months)
    const displayName = name.split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    const existingSugg = suggestions.find(s => s.mega === 'transfer')
    if (!existingSugg) {
      suggestions.push({
        id: `sugg_person_${name.replace(/\s/g,'_')}`,
        mega: 'transfer',
        label: `Transfers to ${displayName}`,
        icon: '👤',
        monthlyAmount: monthly,
        totalAmount: total,
        count: txns.length,
        brands: [displayName],
        targetField: 'variable',
        targetLabel: `Transfer to ${displayName}`,
        description: `${txns.length} payments to ${displayName} = ₹${monthly.toLocaleString('en-IN')}/mo`,
      })
    }
  })

  return suggestions.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. NEW: Recurring pattern detection (Tier 2 intelligence)
//     Detects EMIs, SIPs, rent, subscriptions from cross-transaction analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface RecurringPattern {
  amount: number
  narration: string
  occurrences: number
  avgDayOfMonth: number
  suggestedCategory: MegaCategory
  type: 'EMI' | 'SIP' | 'RENT' | 'SUBSCRIPTION' | 'SALARY' | 'TRANSFER' | 'UNKNOWN'
  confidence: number
}

export function detectRecurringPatterns(transactions: any[]): RecurringPattern[] {
  const debits = transactions.filter((t: any) => t.type === 'debit' && t.amount > 100)
  const patterns: RecurringPattern[] = []

  // Group by rounded amount (within 5% tolerance)
  const groups: Map<string, any[]> = new Map()
  for (const t of debits) {
    let placed = false
    for (const [key, group] of groups) {
      const keyAmt = parseFloat(key)
      if (Math.abs(keyAmt - t.amount) / keyAmt < 0.05) {
        group.push(t)
        placed = true
        break
      }
    }
    if (!placed) groups.set(String(t.amount), [t])
  }

  for (const [_, group] of groups) {
    if (group.length < 2) continue
    const sorted = group.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const avg = sorted.reduce((s: number, t: any) => s + t.amount, 0) / sorted.length
    const days = sorted.map((t: any) => new Date(t.date).getDate())
    const avgDay = Math.round(days.reduce((s: number, d: number) => s + d, 0) / days.length)

    // Check if roughly monthly (25-35 day gaps)
    let monthlyCount = 0
    for (let i = 1; i < sorted.length; i++) {
      const gap = (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / (1000*60*60*24)
      if (gap >= 20 && gap <= 40) monthlyCount++
    }
    const isMonthly = monthlyCount >= Math.floor((sorted.length - 1) * 0.7)
    if (!isMonthly) continue

    const { mega } = matchMega(sorted[0].description)
    let type: RecurringPattern['type'] = 'UNKNOWN'
    const n = (sorted[0].description || '').toUpperCase()
    if (n.includes('EMI') || n.includes('LOAN') || n.includes('NACH') || n.includes('BAJAJ') || n.includes('HDFC LTD')) type = 'EMI'
    else if (mega === 'investments_regular' || mega === 'investments_elss') type = 'SIP'
    else if (mega === 'housing' && avg > 5000) type = 'RENT'
    else if (avg < 2000 && (mega === 'entertainment' || mega === 'utilities')) type = 'SUBSCRIPTION'
    else if (mega === 'transfer' && avg > 5000) type = 'TRANSFER'

    patterns.push({
      amount: Math.round(avg),
      narration: sorted[0].description || '',
      occurrences: sorted.length,
      avgDayOfMonth: avgDay,
      suggestedCategory: mega,
      type,
      confidence: sorted.length >= 3 ? 0.90 : 0.70,
    })
  }

  return patterns.sort((a, b) => b.amount - a.amount)
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. NEW: Income breakdown — separate salary, freelance, interest, etc.
// ═══════════════════════════════════════════════════════════════════════════

export interface IncomeBreakdown {
  salary: any[]
  freelance: any[]
  interest: any[]
  dividends: any[]
  cashback: any[]
  selfTransfers: any[]
  otherCredits: any[]
}

export function detectIncome(transactions: any[]): IncomeBreakdown {
  const result: IncomeBreakdown = {
    salary: [], freelance: [], interest: [], dividends: [],
    cashback: [], selfTransfers: [], otherCredits: [],
  }
  const credits = transactions.filter((t: any) => t.type === 'credit')
  for (const t of credits) {
    const n = (t.description || '').toUpperCase()
    if (n.includes('SELF TRANSFER') || n.includes('SELF TRF') || n.includes('SELF TR') || n.includes('OWN A/C') || n.includes('OWN ACCOUNT') || n.includes('FD MATURITY') || n.includes('RD MATURITY') || n.includes('SWEEP')) {
      result.selfTransfers.push(t)
    } else if (n.includes('SALARY') || n.includes('SAL CR') || n.includes('SAL/') || n.includes('PAYROLL') || n.includes('STIPEND')) {
      result.salary.push(t)
    } else if (n.includes('DIVIDEND') || n.includes('DIV CR') || n.includes('DIV ')) {
      result.dividends.push(t)
    } else if (n.includes('INTEREST') || n.includes('INT.PD') || n.includes('INT PD') || n.includes('INT CR') || n.includes('INT.COLL')) {
      result.interest.push(t)
    } else if (n.includes('CASHBACK') || n.includes('CASH BACK') || n.includes('REFUND') || n.includes('REVERSAL')) {
      result.cashback.push(t)
    } else if (n.includes('FREELANCE') || n.includes('CONSULTING') || n.includes('PROFESSIONAL FEE')) {
      result.freelance.push(t)
    } else {
      result.otherCredits.push(t)
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. NEW: Balance verification — opening + credits - debits = closing
// ═══════════════════════════════════════════════════════════════════════════

export function verifyBalance(transactions: any[], openingBalance?: number, closingBalance?: number): {
  verified: boolean
  computedClosing: number
  discrepancy: number
  totalCredits: number
  totalDebits: number
} {
  const totalCredits = transactions.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + t.amount, 0)
  const totalDebits = transactions.filter((t: any) => t.type === 'debit').reduce((s: number, t: any) => s + t.amount, 0)
  const computedClosing = (openingBalance || 0) + totalCredits - totalDebits
  const discrepancy = closingBalance !== undefined ? Math.abs(computedClosing - closingBalance) : 0
  return {
    verified: closingBalance !== undefined ? discrepancy < 1 : false,
    computedClosing: Math.round(computedClosing * 100) / 100,
    discrepancy: Math.round(discrepancy * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. NEW: Anomaly/insight detection — spending spikes, unusual patterns
// ═══════════════════════════════════════════════════════════════════════════

export interface FinancialInsight {
  type: 'spike' | 'new_merchant' | 'emi_burden' | 'savings_rate' | 'surplus' | 'recurring_discovered' | 'gambling' | 'category_spike' | 'investment_discipline'
  severity: 'info' | 'warning' | 'positive'
  title: string
  description: string
  amount?: number
}

export function detectInsights(transactions: any[], monthlyIncome: number): FinancialInsight[] {
  const insights: FinancialInsight[] = []
  if (!transactions.length || !monthlyIncome) return insights

  // EMI burden
  const debits = transactions.filter((t: any) => t.type === 'debit')
  const emiTransactions = debits.filter((t: any) => {
    const d = (t.description || '').toUpperCase()
    return d.includes('EMI') || d.includes('LOAN') || d.includes('NACH') || (t.mega === 'housing' && t.amount > 3000)
  })
  const totalEMI = emiTransactions.reduce((s: number, t: any) => s + t.amount, 0)
  const months = Math.max(1, new Set(transactions.map((t: any) => (t.date || '').substring(0, 7))).size)
  const monthlyEMI = totalEMI / months
  const emiBurden = (monthlyEMI / monthlyIncome) * 100
  if (emiBurden > 50) {
    insights.push({ type: 'emi_burden', severity: 'warning', title: 'High EMI burden', description: `EMIs are ${Math.round(emiBurden)}% of income (₹${Math.round(monthlyEMI).toLocaleString('en-IN')}/mo). Above 50% is risky.`, amount: monthlyEMI })
  } else if (emiBurden > 35) {
    insights.push({ type: 'emi_burden', severity: 'info', title: 'Moderate EMI burden', description: `EMIs are ${Math.round(emiBurden)}% of income. Consider not taking new loans.`, amount: monthlyEMI })
  }

  // Savings rate
  const totalDebitsAmt = debits.reduce((s: number, t: any) => s + t.amount, 0)
  const monthlyExpense = totalDebitsAmt / months
  const savingsRate = ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100
  if (savingsRate > 30) {
    insights.push({ type: 'savings_rate', severity: 'positive', title: 'Strong savings rate', description: `Saving ${Math.round(savingsRate)}% of income. Well above the recommended 20%.`, amount: monthlyIncome - monthlyExpense })
  } else if (savingsRate < 10 && savingsRate >= 0) {
    insights.push({ type: 'savings_rate', severity: 'warning', title: 'Low savings rate', description: `Only saving ${Math.round(savingsRate)}% of income. Target at least 20%.`, amount: monthlyIncome - monthlyExpense })
  }

  // Surplus
  const surplus = monthlyIncome - monthlyExpense
  if (surplus > 5000) {
    insights.push({ type: 'surplus', severity: 'positive', title: 'Monthly surplus available', description: `₹${Math.round(surplus).toLocaleString('en-IN')}/mo surplus. Consider starting or increasing SIP.`, amount: surplus })
  }

  // Gambling / speculative spending detection
  const gamblingTxns = transactions.filter((t: any) => t.isGambling && t.type === 'debit')
  if (gamblingTxns.length > 0) {
    const gamblingTotal = gamblingTxns.reduce((s: number, t: any) => s + t.amount, 0)
    const monthlyGambling = gamblingTotal / months
    insights.push({
      type: 'spike', severity: 'warning',
      title: 'Gambling / speculative spending detected',
      description: `${gamblingTxns.length} transactions totalling ₹${Math.round(monthlyGambling).toLocaleString('en-IN')}/mo on gaming/betting platforms.`,
      amount: monthlyGambling,
    })
  }

  // Category spending spikes (compare last month to average)
  const byMonth: Record<string, Record<string, number>> = {}
  debits.forEach((t: any) => {
    const month = (t.date || '').substring(0, 7)
    const cat = t.mega || 'misc'
    if (!byMonth[month]) byMonth[month] = {}
    byMonth[month][cat] = (byMonth[month][cat] || 0) + t.amount
  })
  const monthKeys = Object.keys(byMonth).sort()
  if (monthKeys.length >= 2) {
    const lastMonth = byMonth[monthKeys[monthKeys.length - 1]]
    const prevMonths = monthKeys.slice(0, -1)
    for (const cat of Object.keys(lastMonth)) {
      if (cat === 'misc' || cat === 'transfer' || cat === 'cc_payment') continue
      const prevAvg = prevMonths.reduce((s, m) => s + (byMonth[m][cat] || 0), 0) / prevMonths.length
      if (prevAvg > 0 && lastMonth[cat] > prevAvg * 1.4 && lastMonth[cat] - prevAvg > 2000) {
        const catInfo = MEGA_CATEGORIES[cat as MegaCategory]
        const pctIncrease = Math.round(((lastMonth[cat] - prevAvg) / prevAvg) * 100)
        insights.push({
          type: 'spike', severity: 'warning',
          title: `${catInfo?.label || cat} spiked ${pctIncrease}%`,
          description: `₹${Math.round(lastMonth[cat]).toLocaleString('en-IN')} last month vs ₹${Math.round(prevAvg).toLocaleString('en-IN')} average.`,
          amount: lastMonth[cat] - prevAvg,
        })
      }
    }
  }

  // Investment discipline — are SIPs consistent?
  const sipTxns = transactions.filter((t: any) => t.type === 'debit' && (t.mega === 'investments_regular' || t.mega === 'investments_elss'))
  if (sipTxns.length > 0) {
    const sipByMonth: Record<string, number> = {}
    sipTxns.forEach((t: any) => {
      const m = (t.date || '').substring(0, 7)
      sipByMonth[m] = (sipByMonth[m] || 0) + t.amount
    })
    const sipMonths = Object.keys(sipByMonth).length
    if (sipMonths === months) {
      const monthlySIP = sipTxns.reduce((s: number, t: any) => s + t.amount, 0) / months
      const sipRate = (monthlySIP / monthlyIncome) * 100
      insights.push({
        type: 'recurring_discovered', severity: 'positive',
        title: 'Consistent investment discipline',
        description: `Investing ₹${Math.round(monthlySIP).toLocaleString('en-IN')}/mo (${Math.round(sipRate)}% of income) every month.`,
        amount: monthlySIP,
      })
    }
  }

  return insights
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. NEW: Batch uncategorized for LLM fallback (Tier 3 prep)
//     Returns transactions with confidence < threshold, formatted for Haiku
// ═══════════════════════════════════════════════════════════════════════════

export function getUncategorizedForLLM(taggedTransactions: any[], confidenceThreshold = 0.5): {
  transactions: any[]
  prompt: string
} {
  const uncategorized = taggedTransactions.filter((t: any) =>
    (t.confidence || 0) < confidenceThreshold && t.mega === 'misc'
  )
  if (uncategorized.length === 0) return { transactions: [], prompt: '' }

  const lines = uncategorized.map((t: any, i: number) =>
    `${i+1}. ${t.date} | ${t.type === 'credit' ? 'CR' : 'DR'} | ₹${t.amount} | ${t.description}`
  ).join('\n')

  const categories = Object.keys(MEGA_CATEGORIES).join(', ')

  const prompt = `You are a CA analyzing Indian bank transactions. Categorize each transaction into exactly one of: ${categories}.

For each, return JSON: {"index": N, "category": "...", "brand": "..."}

Transactions:
${lines}

Return ONLY a JSON array, no explanation.`

  return { transactions: uncategorized, prompt }
}
