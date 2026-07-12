# FY 2026-27 rule-set verification (Task T1)

**Verdict: the FY 2026-27 rule set is IDENTICAL to FY 2025-26.** Not near-identical —
byte-for-byte identical, because it is the *same object*:

```ts
// src/lib/tax-slabs.ts
const FY_2026_27: RuleSet = FY_2025_26
```

## ⚠️ What this means (read this)

**"Plan ahead" mode is currently rendering *this* year's tax math under *next* year's
label.** Because FY 2026-27 == FY 2025-26 in the engine, a user who picks "Plan ahead"
sees the FY 2025-26 numbers with an FY 2026-27 heading. That is *correct only if* the
enacted FY 2026-27 rules truly equal FY 2025-26 — and that has **not** been
independently signed off.

- FY **2025-26** is validated field-for-field against the Income Tax Dept portal
  (AY 2026-27).
- FY **2026-27** rests only on **web-sourced Budget-2026 coverage** ("no slab change")
  gathered by the assistant — ClearTax / BusinessToday / Axis Max Life, Feb 2026. There
  is **no founder or CA sign-off** on record that these are the final enacted figures.

Per the Task T1 protocol, the assistant **did not invent any FY 2026-27 values.** The
copy is deliberate and documented, but it is a copy.

## Field-by-field diff

Both keys in `TAX_RULES` point to the one `FY_2025_26` object, so all fields match.

| Field | FY 2025-26 | FY 2026-27 | Match |
|---|---|---|---|
| New-regime slabs | 0–4L @0, 4–8L 5%, 8–12L 10%, 12–16L 15%, 16–20L 20%, 20–24L 25%, 24L+ 30% | same | ✓ identical |
| Old — normal | 0–2.5L @0, 2.5–5L 5%, 5–10L 20%, 10L+ 30% | same | ✓ identical |
| Old — senior (60–80) | 0–3L @0, 3–5L 5%, 5–10L 20%, 10L+ 30% | same | ✓ identical |
| Old — super-senior (80+) | 0–5L @0, 5–10L 20%, 10L+ 30% | same | ✓ identical |
| 87A rebate — new | taxable ≤ ₹12L → ₹60,000 (+ marginal relief) | same | ✓ identical |
| 87A rebate — old | taxable ≤ ₹5L → ₹12,500 | same | ✓ identical |
| Standard deduction | new ₹75,000 / old ₹50,000 | same | ✓ identical |
| Surcharge — exempt up to | ₹50L | same | ✓ identical |
| Surcharge — bands | ₹50L–1Cr 10%, 1–2Cr 15%, 2–5Cr 25% | same | ✓ identical |
| Surcharge — above ₹5Cr | new 25% / old 37% | same | ✓ identical |
| Cess | 4% | same | ✓ identical |

## Recommendation (new task, not this PR)

Encoding the **real, enacted** Feb-2026 budget figures for FY 2026-27 is a **separate
task that needs founder + CA sign-off** on the actual numbers before it ships. Until
then:

1. Treat the FY 2026-27 entry as **provisional-by-copy** — it is safe *only* while the
   enacted rules genuinely match FY 2025-26.
2. Do **not** let a future "relabel with new numbers" pass silently. Because the two are
   the same object today there is no distinctness test to add here; the guard is this
   report plus the pointer comment beside `FY_2026_27`. The moment someone gives the
   entry its own values, that becomes a real, testable rule set and should get a test
   asserting at least one known FY26-27 vs FY25-26 difference.
3. Product decision owed: whether "Plan ahead" should be **hidden/disabled** until real
   FY 2026-27 rules land, rather than showing this-year math under a next-year label.

_No engine, resolver, or verdict logic was changed by this task — report only._
