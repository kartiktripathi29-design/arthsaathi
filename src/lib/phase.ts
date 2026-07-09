// Single source of truth for whether Phase-2 features are enabled.
//
// Phase-2 covers the planning/investment surface (Invest, DNA, Decide) plus bank-statement and
// demat/CAS ingestion. While Phase-2 is OFF, the Phase-2 *pages* redirect away client-side — but UI
// gating is not API gating, so the Phase-2 *API routes* must also refuse to run server-side. Both
// layers read THIS one constant. No env var: flip it to turn Phase-2 on everywhere at once.
export const PHASE_2_ENABLED = false
