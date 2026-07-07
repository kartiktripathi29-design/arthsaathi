// Shared writers for the quick provisional flow (ProvisionalVerdict + the tax-breaks wizard).
//
// The HRA exemption is computed in exactly ONE place — the canonical Rule 2A engine
// (computeAnnualHraExemption) — so the two quick-entry points can never diverge from each other or
// from the Exemptions page / optimizer. This deliberately fixes three correctness bugs the earlier
// inline copies had:
//   • they fabricated "HRA received" as 50% of basic when a slip had no HRA line item, granting an
//     exemption the filer isn't entitled to (HRA exemption requires HRA to actually be received);
//   • they hardcoded isMetro:true / the 50% cap for everyone, over-stating non-metro exemptions;
//   • they replaced the whole av_exemptions.hra object, dropping fields the Allowances page saved.
// Here we cap at the REAL per-month HRA from the salary basis, honour a previously-chosen isMetro
// (defaulting to non-metro — the conservative 40% — when unknown), and merge into the saved object.

import { computeAnnualHraExemption, type HraMonth } from './salary-analytics'
import { getSalaryFacts } from './salary-facts'

const readJSON = (k: string): any => { try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} } }
const writeJSON = (k: string, o: any) => { try { localStorage.setItem(k, JSON.stringify(o)) } catch {} }

// A 12-month Basic+HRA series to annualise the exemption over. Prefer the real per-month basis from
// the salary summary (reflects mid-year raises); otherwise fall back to a flat estimate with NO HRA
// component — so a filer whose HRA we can't see gets ₹0 exemption, never a fabricated one.
function hraBasis12(): HraMonth[] {
  const facts = getSalaryFacts()
  if (facts.hraBasis?.length) return facts.hraBasis
  const basic = Math.round((facts.annualGross * 0.4) / 12)
  return Array.from({ length: 12 }, () => ({ basic, hra: 0, monthKey: '' })) as HraMonth[]
}

/** Persist a monthly rent + the correctly-computed annual HRA exemption, merging into any saved hra. */
export function applyRentToExemptions(rentMonthly: number): void {
  const exm = readJSON('av_exemptions')
  const prev = exm.hra || {}
  // Honour a metro choice the Allowances page saved; default to non-metro (40%) when unknown.
  const isMetro = typeof prev.isMetro === 'boolean' ? prev.isMetro : false
  const comp = rentMonthly > 0 ? computeAnnualHraExemption(hraBasis12(), rentMonthly, isMetro) : null
  exm.hra = {
    ...prev,
    rentPaid: rentMonthly,
    isMetro,
    noRent: false,
    annualExemption: comp ? comp.annualExemption : 0,
  }
  writeJSON('av_exemptions', exm)
}

/** Record "I don't pay rent" without discarding other saved hra fields. */
export function markNoRentExemptions(): void {
  const exm = readJSON('av_exemptions')
  exm.hra = { ...(exm.hra || {}), rentPaid: 0, annualExemption: 0, noRent: true }
  writeJSON('av_exemptions', exm)
}
