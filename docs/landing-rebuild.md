# Landing Page — Honest Rebuild (own step, after Step 9)

This is a second claims-removal pass + bug fixes + copy + UI, NOT a copy-only item. Needs explicit approval on each change before editing. The entire page (src/app/page.tsx) is inline-styled.

## CLAIMS / PROMISES to remove or fix
- The "₹68,000 / save ₹X" motif appears at: ticker (:40), hero badge (:123), quick-calc result (:152), stats strip (:174). UNBACKED.
- The quick-calculator is FAKE: "save ₹X" = annual salary × 0.06 flat heuristic (:60-66), not a real tax calc; "Check now" just routes to /signup. DECISION REQUIRED: remove / make-real (wire to tax-slabs.ts) / neuter (keep input, drop the fabricated result). [DECIDED — see CALCULATOR (decided) below: real calc reusing tax-slabs engine, softened-C frame, verification required]
- "government tax document / records" framing implies an official tie: hero subhead (:132), pain card fixes (:201, :215), step 01 (:246).
- "Where to invest" advice framing — step 04 (:249); points at the hidden Phase-2 invest feature.
- Over-promises to soften: "find everything ... automatically" (:247, AIS is manual+partial), "handles it for you" (:215), "exactly how to get it back" (:132), "reads any slip / any company" (:43, :176).

## CALCULATOR (decided)
- Replace the fake ×0.06 quick-calc with a REAL calculator that reuses the existing engine — estimateAnnualTax(annual, 'new'|'old') from src/lib/tax-slabs.ts. NOT a new/separate engine — one engine so landing and app can't drift.
- Frame = "softened C": disruptor header ("Your employer taxed what they knew. Not what's true for you."), show New vs Old regime tax from salary alone, honest "before your deductions" caveat + footnote, CTA "Find your regime →" to /signup.
- VERIFICATION REQUIRED before ship: (1) read tax-slabs.ts slab/rebate/surcharge constants and sanity-check vs real FY 2025-26/26-27 rules; (2) after build, test 2-3 known salaries against a trusted external calculator and confirm outputs match.
- Mockup numbers used in planning were illustrative, not engine output.

## BUGS
- Stats strip "6800" renders as "₹68L" via the >=1000 -> Rs{count/100}L formatter (:30) — wrong; inconsistent with "₹68,000" used elsewhere.
- StatCard label is dark-on-dark on the dark stats strip (:32 ink text on :171 ink bg) — near-invisible.

## OLD POSITIONING
- Tagline: chrome handled in Step 9 (3-tier split — wordmark alone in-app; functional descriptor on auth/metadata). The STORYTELLING brand line + enlarged centred-logo hero treatment is to be designed HERE as part of the hero composition, at Phase-2 execution. Do not reuse the Phase-1 functional descriptor as the permanent tagline.
- "8 minutes" repeated 5x: :41, :132, :175, :241, :272 — decide keep/cut. [PENDING]
- BgDemo mock (:166) shows dummy savings/figures.

## UI / STYLING
- Dark-background sections (hero pulse badge :121, stats strip :171, final CTA :263, footer :290): any button must be green/ivory, NEVER teal (teal vanishes on dark — existing code already routes around this).
- Decorative pain-tag hex (#DC2626 / #D97706 / #7C3AED at :203, :210, :217) — intentionally kept.
- Page is 100% inline-styled (global <style> :70-91 + per-element style objects).
