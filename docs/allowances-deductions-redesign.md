# Allowances & Deductions — Redesign Spec (tier-3 polish)

## User (confirmed)
Primary = the Self-Filer: 25–32, IT/tech salaried, ₹8–18L, metro, files own ITR, no real tax knowledge needed. Design serves someone who shouldn't have to understand tax codes. Vision: "clarity, not advice" — the page does the thinking about what's relevant; calm on arrival.

## ALLOWANCES — structural fix (a rare tail exists for this user)
Surface, always open: HRA, LTA.
Two categorized collapsed groups (NOT one "misc" bin — categories read as organized, not hidden):
- Group A "Company car & travel perks" → Driver salary, Car running costs, Daily allowance. Sub: "If your employer provides a car, driver, or per-day travel allowance."
- Group B "Retirement & exit payouts" → Superannuation, PF withdrawal, Gratuity. Sub: "One-off amounts when you retire, leave a job, or withdraw your PF."
Groups collapsed by default; sub-line always visible so a rare user self-identifies without opening.

## DEDUCTIONS — value-surfacing fix (NO bundling; all 7 are plausibly relevant to this user)
- Lead each card with the ₹ it SAVES (marginal saving = deduction × user's marginal rate), shown before/above the form. (⚠️ Prerequisite: needs a real per-user marginal-rate calc — see Implementation Safety. Do not ship on the hardcoded flat 30%.)
- Live, prominent running tax-savings total that updates as fields fill.
- Do NOT collapse/hide any deduction — there's no rare tail; hiding = "did I miss something?" anti-clarity.

## SHARED — sub-label density (Option A: demote, don't delete)
- Collapsed sub-label → short PLAIN hint (no section code). Keep plain-useful caps (₹1.5L, ₹2L, ₹50k).
- Section code + mechanism → moved INTO the expanded body (grey). For Allowances SimpleSection items this means using/extending the belowField prop (no body code slot today). For sections where code is already in the body (80TTA, 80G, 80C), just trim the sub.

## LAYOUT PRINCIPLES (the "make it appealing" answer — hierarchy, not cosmetics)
1. Unequal weight by importance — surfaced common items (HRA/LTA; core deductions) visually more prominent than collapsed/grouped items. The single biggest lever; fixes the "8 equal rectangles" fatigue.
2. Compact collapsed bars — collapsed sections are slim scannable bars (question + slim value indicator + expand affordance), NOT tall full-height cards. Expanded state earns the space.
3. At-a-glance filled/empty state — a filled section looks visibly different from an untouched one when collapsed (show claimed amount on the bar / subtle done-state).
4. Aligned value column — right-align all ₹ amounts (claimed/caps/totals) in a consistent column so numbers read down cleanly.
5. Token-driven surface polish LAST — spacing rhythm, card border/fill, expand affordance. Must use the repo's existing design tokens / frontend-design system, NOT invented styles. This layer finishes a well-structured page; it can't rescue an unstructured one.

## IMPLEMENTATION SAFETY (hard rules)
- Visual/presentation only. Every field keeps its existing state key (s.driverSalary, s.carMaintenance, HRA fields, etc.) and calc wiring UNCHANGED. Grouping is visual, never data-merging.
- Collapsed groups stay MOUNTED (display:none / CSS hide), never conditionally unmounted — a value entered in a closed group must still feed the tax engine. This is the one thing that, done carelessly, breaks the calc.
- The optimizer currently HARDCODES a flat 30% in the "where you can save" section — it does NOT expose a real per-user marginal rate. "Lead with ₹ saved" therefore has a dependency: build a real marginal-rate calc (based on the user's slab) FIRST, or the displayed saving is only approximate (flat 30%), which for a clarity-first product is a half-truth to avoid. Treat the marginal-rate calc as a prerequisite, not part of the layout work.
- Touches SimpleSection (shared component) + exemptions/page.tsx + deductions/page.tsx. Scope as a redesign, not a tweak.

## PRIORITY
Tier-3. Build AFTER: landing launch-blockers (₹68L claim, SEBI badge, navy-on-navy labels, speed headline) and the Tax Optimizer verdict-lift. Pages are currently accurate and functional; this is polish, not correction.
