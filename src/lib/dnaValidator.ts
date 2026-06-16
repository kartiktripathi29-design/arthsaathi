// Financial DNA Validator
// Compares questionnaire personality (claimed) with actual bank + profile data (real)
// Returns gap analysis, evolved DNA, and personalised insights

export type DNAType = 'E' | 'B' | 'P' | 'O'

export interface FinancialData {
  netSalary: number
  totalExp: number
  totalVar: number
  totalSav: number
  bankSummary?: {
    food?: number; fuel?: number; shopping?: number
    entertainment?: number; grocery?: number; sip?: number
    investment?: number; salary?: number
  }
}

export interface ValidationResult {
  claimedType: DNAType
  evolvedType: DNAType
  matchScore: number          // 0–100, how well behaviour matches claim
  shifted: boolean            // did the evolved type change?
  signals: Signal[]           // specific behavioural observations
  gaps: Gap[]                 // where claimed ≠ actual
  positives: string[]         // where they're doing better than they claimed
  evolvedSummary: string      // one sentence on evolved DNA
}

interface Signal {
  label: string
  value: string
  type: 'match' | 'gap' | 'positive'
  insight: string
}

interface Gap {
  claim: string         // what personality implies
  reality: string       // what data shows
  cost: string          // what this gap costs them
  nudge: string         // gentle, on-their-side fix
}

// Behavioral thresholds
const T = {
  freeSpiritFood: 0.12,        // >12% on food = free spirit signal
  freeSpiritEnt: 0.08,         // >8% entertainment = free spirit
  freeSpiritSav: 0.08,         // <8% savings = free spirit
  balancerSav: 0.12,           // 12–22% savings = balancer
  protectorSav: 0.22,          // >22% savings = protector
  maximiserSav: 0.25,          // >25% = maximiser
  noEmergency: 3,              // <3x monthly expenses = no emergency fund
  goodSavings: 0.20,           // 20%+ is healthy
}

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

export function validateDNA(claimed: DNAType, data: FinancialData): ValidationResult {
  const { netSalary: inc, totalExp: exp, totalVar: vari, totalSav: sav, bankSummary: b } = data
  if (!inc) return { claimedType: claimed, evolvedType: claimed, matchScore: 0, shifted: false, signals: [], gaps: [], positives: [], evolvedSummary: 'Add your income to see your evolved DNA.' }

  const savRate = sav / inc
  const food = b?.food || 0
  const ent = b?.entertainment || 0
  const shop = b?.shopping || 0
  const foodRate = food / inc
  const entRate = ent / inc

  const signals: Signal[] = []
  const gaps: Gap[] = []
  const positives: string[] = []
  let freeSpiritScore = 0, balancerScore = 0, protectorScore = 0, maximiserScore = 0

  // ── Savings rate signal ──────────────────────────────────────────────────
  if (savRate >= T.maximiserSav) {
    maximiserScore += 3; balancerScore += 1
    signals.push({ label: 'Savings rate', value: `${Math.round(savRate*100)}%`, type: 'positive', insight: `${Math.round(savRate*100)}% savings rate — top tier. This is Maximiser behaviour.` })
    if (claimed === 'E') positives.push(`You save ${Math.round(savRate*100)}% of your income — that's stronger than most Balancers. Your Free Spirit identity might be evolving.`)
  } else if (savRate >= T.protectorSav) {
    protectorScore += 2; balancerScore += 2
    signals.push({ label: 'Savings rate', value: `${Math.round(savRate*100)}%`, type: 'positive', insight: `${Math.round(savRate*100)}% — healthy. You save consistently.` })
    if (claimed === 'E') positives.push(`You claim to be a Free Spirit but you save ${Math.round(savRate*100)}% — that's Protector territory. There's a quiet disciplined side to you.`)
  } else if (savRate >= T.balancerSav) {
    balancerScore += 2
    signals.push({ label: 'Savings rate', value: `${Math.round(savRate*100)}%`, type: 'match', insight: `${Math.round(savRate*100)}% — decent. Typical Balancer range.` })
  } else if (savRate >= T.freeSpiritSav) {
    freeSpiritScore += 1; balancerScore += 1
    signals.push({ label: 'Savings rate', value: `${Math.round(savRate*100)}%`, type: 'gap', insight: `${Math.round(savRate*100)}% — below the 20% target.` })
    if (claimed !== 'E') gaps.push({
      claim: `${claimed === 'P' ? 'Protectors prioritise financial security' : claimed === 'O' ? 'Maximisers make every rupee work' : 'Balancers keep one eye on the future'}`,
      reality: `Your savings rate is ${Math.round(savRate*100)}% — below the 20% mark`,
      cost: `The gap between ${Math.round(savRate*100)}% and 20% is ${fmt((inc * 0.2 - sav) * 12)}/year in missed savings`,
      nudge: `One SIP increase of ${fmt(inc * 0.2 - sav)}/month closes this completely`
    })
  } else {
    freeSpiritScore += 3
    signals.push({ label: 'Savings rate', value: `${Math.round(savRate*100)}%`, type: 'gap', insight: `${Math.round(savRate*100)}% — this is where the gap lives.` })
    if (claimed !== 'E') gaps.push({
      claim: `${claimed === 'P' ? 'Protectors build financial cushions' : claimed === 'O' ? 'Maximisers deploy capital aggressively' : 'Balancers keep savings intentional'}`,
      reality: `Savings rate of ${Math.round(savRate*100)}% suggests spending is taking priority right now`,
      cost: `At this rate, you're leaving ${fmt((inc * 0.2 - sav) * 12)}/year of wealth-building on the table`,
      nudge: `Automating ${fmt(inc * 0.2 - sav)}/month before it hits your account is the single biggest change you can make`
    })
  }

  // ── Food & dining signal ──────────────────────────────────────────────────
  if (food > 0) {
    if (foodRate > T.freeSpiritFood) {
      freeSpiritScore += 2
      signals.push({ label: 'Food & dining', value: `${Math.round(foodRate*100)}% of income`, type: foodRate > 0.18 ? 'gap' : 'match', insight: `${fmt(food)}/month on food — that's ${Math.round(foodRate*100)}% of income.` })
      if (claimed === 'P' || claimed === 'O') gaps.push({
        claim: `${claimed === 'P' ? 'Protectors keep discretionary spend tight' : 'Maximisers optimise every category'}`,
        reality: `${fmt(food)}/month on food & dining (${Math.round(foodRate*100)}% of income)`,
        cost: `Over a year that's ${fmt(food*12)} — invested instead, it could be ${fmt(food*12*3)} in 10 years`,
        nudge: `Not about cutting — about knowing. Setting a ${fmt(Math.round(inc*0.1))}/month food budget still lets you eat well`
      })
    } else {
      balancerScore += 1
      signals.push({ label: 'Food & dining', value: `${Math.round(foodRate*100)}% of income`, type: 'match', insight: `${fmt(food)}/month on food — healthy proportion.` })
    }
  }

  // ── Entertainment signal ──────────────────────────────────────────────────
  if (ent > 0 && entRate > T.freeSpiritEnt) {
    freeSpiritScore += 1
    signals.push({ label: 'Entertainment', value: `${Math.round(entRate*100)}% of income`, type: 'gap', insight: `Entertainment at ${Math.round(entRate*100)}% — above the 5% benchmark.` })
  }

  // ── SIP / investment signal ───────────────────────────────────────────────
  const hasSIP = (b?.sip || 0) > 0 || sav > 0
  if (hasSIP) {
    maximiserScore += 1; balancerScore += 1
    signals.push({ label: 'Investments', value: b?.sip ? fmt(b.sip)+'/mo SIP' : fmt(sav)+'/mo savings', type: 'positive', insight: 'You\'re investing. That\'s the most important thing.' })
    if (claimed === 'E') positives.push(`You said you\'re a Free Spirit — but you have an active SIP. That\'s a Balancer move. You're more disciplined than you give yourself credit for.`)
  } else if (claimed === 'O' || claimed === 'P') {
    gaps.push({
      claim: `${claimed === 'O' ? 'Maximisers have systematic investment plans' : 'Protectors build assets consistently'}`,
      reality: 'No active SIP or recurring investment detected',
      cost: `Starting a ${fmt(Math.round(inc * 0.15))}/month SIP today could build ${fmt(Math.round(inc * 0.15 * 12 * 10 * 1.5))} in 10 years`,
      nudge: 'One 5-minute setup on Zerodha Coin or Groww and it runs itself'
    })
  }

  // ── Determine evolved type ────────────────────────────────────────────────
  const behavScores: Record<DNAType, number> = { E: freeSpiritScore, B: balancerScore, P: protectorScore, O: maximiserScore }
  const evolvedType = Object.entries(behavScores).sort((a,b) => b[1]-a[1])[0][0] as DNAType

  // Match score: how closely does evolved match claimed
  const claimedScore = behavScores[claimed]
  const maxScore = Math.max(...Object.values(behavScores))
  const matchScore = maxScore > 0 ? Math.round((claimedScore / maxScore) * 100) : 50

  const shifted = evolvedType !== claimed

  // Evolved summary
  const typeNames: Record<DNAType, string> = { E:'Free Spirit', B:'Balancer', P:'Protector', O:'Maximiser' }

  const evolvedSummary = shifted
    ? `You answered like a ${typeNames[claimed]}, but your spending shows ${typeNames[evolvedType]} patterns. That gap is exactly where ArthVo works.`
    : `Your spending confirms it — you\'re a ${typeNames[claimed]} through and through. Your plan is built around that.`

  return { claimedType: claimed, evolvedType, matchScore, shifted, signals, gaps, positives, evolvedSummary }
}
