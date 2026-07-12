// validate-past-years.mjs — check the Past-years "could-have-saved" number against a real ITR.
//
// USAGE:  node scripts/validate-past-years.mjs <itr.json> <expectedSaving> [seniorStatus]
//   <itr.json>        path to an ITR JSON in the ParsedITR shape the Past-years upload accepts
//   <expectedSaving>  the could-have-saved (regime-switch) figure you expect, in whole rupees
//   [seniorStatus]    optional: normal | senior | super_senior   (default: normal)
//
// It runs the REAL engine (src/lib/itr-parse normalizeReturn -> tax-history computeSavings), prints
// every intermediate (gross, exemptions/VI-A applied, both-regime taxable income + tax, the delta),
// and exits 0 on PASS / 1 on FAIL (2 on bad input). No engine code lives here — it only calls the app.
//
// PASS = exact whole-rupee match. Check 3-5 real returns in one sitting, e.g.:
//   node scripts/validate-past-years.mjs scripts/fixtures/sample-itr.json 45500
//   for f in ./my-itrs/*.json; do node scripts/validate-past-years.mjs "$f" "$EXP"; done

import { readFileSync } from 'node:fs'
import { normalizeReturn } from '../src/lib/itr-parse.ts'

const [, , itrPath, expectedRaw, senior = 'normal'] = process.argv
if (!itrPath || expectedRaw == null) {
  console.error('Usage: node scripts/validate-past-years.mjs <itr.json> <expectedSaving> [seniorStatus]')
  process.exit(2)
}
const expected = Math.round(Number(expectedRaw))
if (!Number.isFinite(expected)) {
  console.error(`expectedSaving must be a number, got: ${expectedRaw}`)
  process.exit(2)
}

let parsed
try {
  parsed = JSON.parse(readFileSync(itrPath, 'utf8'))
} catch (e) {
  console.error(`Cannot read/parse ${itrPath}: ${e.message}`)
  process.exit(2)
}

const money = (v) => {
  const n = Math.round(Number(v) || 0)
  return (n < 0 ? '-' : '') + 'Rs ' + Math.abs(n).toLocaleString('en-IN')
}
const line = (k, v) => console.log('  ' + String(k).padEnd(32) + v)

const n = normalizeReturn(parsed, senior)

console.log(`\nITR: ${itrPath}`)
line('FY / AY', `${n.fy || '-'} / ${n.ay || '-'}${n.fySupported ? '' : '  [UNSUPPORTED FY]'}`)
line('Filed regime', `${n.filedRegime}  (source: ${n.regimeSource})`)
if (n.missing && n.missing.length) line('Missing fields', n.missing.join(', '))

if (!n.canComputeSavings || !n.savings) {
  console.log('\n  RESULT: cannot compute savings (unsupported FY or missing gross salary).')
  console.log('  [FAIL]\n')
  process.exit(1)
}

const s = n.savings
const c = n.components

console.log('\n  -- inputs --')
line('Gross salary', money(c.grossSalary))
line('s.10 exemptions (old only)', money(c.exemptAllowances))
line('Chapter VI-A (old only)', money(c.chapterVIA))
line('Other slab income', money(c.otherSlabIncome))

const regime = (label, r) => {
  console.log(`\n  -- ${label} (${r.regime}) --`)
  line('Standard deduction', money(r.standardDeduction))
  line('Taxable income', money(r.taxableIncome))
  line('Basic tax', money(r.basicTax))
  line('Rebate 87A', money(r.rebate))
  line('Surcharge', money(r.surcharge))
  line('Cess', money(r.cess))
  line('Total tax', money(r.totalTax))
}
regime('As filed', s.asFiled)
regime('Alternate', s.alternate)

console.log('\n  -- verdict --')
line('Cheaper regime', s.cheaperRegime)
line('Could-have-saved (engine)', money(s.regimeSwitchSaving))
line('Could-have-saved (expected)', money(expected))
const diff = s.regimeSwitchSaving - expected
line('Diff (engine - expected)', (diff >= 0 ? '+' : '') + money(diff))

const pass = diff === 0
console.log(`\n  ${pass ? '[PASS]' : '[FAIL]'}  engine ${money(s.regimeSwitchSaving)} vs expected ${money(expected)}\n`)
process.exit(pass ? 0 : 1)
