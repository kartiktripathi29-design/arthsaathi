'use client'
// PROTOTYPE (Phase 1) — in-app provisional-verdict step. Thin wrapper over the shared
// <ProvisionalVerdict>; here the CTA hands off to the full optimizer. (The public, pre-auth twin
// lives at /try and reuses the same component — see Phase 4.)

import ProvisionalVerdict from '@/components/ProvisionalVerdict'

export default function StartPage() {
  return (
    <ProvisionalVerdict
      ctaHref="/dashboard/tax/optimizer"
      ctaLabel="See the full breakdown →"
      noSalaryHref="/dashboard/profile/documents"
      noSalaryLabel="Add your slip →"
      secondaryHref="/dashboard/tax/wizard"
      secondaryLabel="Prefer one question at a time? Walk it step by step →"
    />
  )
}
