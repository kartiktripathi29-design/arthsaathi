# Deploy Notes

## Fixed
- Prisma client not generated on clean builds (Vercel "Module not found: generated/prisma/client"). Fixed in package.json: added "postinstall": "prisma generate" and prefixed build with "prisma generate &&". Commit fed3dad.

## Required env vars in Vercel (preview/production)
- DATABASE_URL — src/lib/db.ts throws at RUNTIME if unset. Build succeeds without it; DB routes (e.g. /api/user-data) error at runtime until set.
- ANTHROPIC_API_KEY — needed for document parsing (salary/AIS); without it parsing fails with a 500 ("Failed to parse document"). (Note: 422 is the separate wrong-password path, not the missing-key case.)
- Supabase keys (NEXT_PUBLIC_SUPABASE_URL + anon key) — needed for real auth; without them login falls back to mock.

## Pre-launch (separate small tasks, NOT copy/UI)
- Other-earnings Save validation: block saving empty/zero income entries (~10-line guard on handleSave). Recommended PRE-LAUNCH.

## Phase-2 (logged)
- Question-based Stocks vs Trading routing (eliminates misclassification vs. copy warning).
- AIS coverage expansion to rental/other income (currently maps only interest/dividends/capital-gains).

## Minor cleanup
- Remove stray ~/package-lock.json on the dev machine (Next workspace-root warning).
- ui.tsx slate-grey → fold into palette tokens. Prune dead navy CSS (.nav-link/.chat-user).

## Known engine limitations (Phase-2)
- tax-slabs.ts calcSurcharge applies flat surcharge rates with NO marginal relief at band boundaries (esp. the ₹50L threshold) — real rule caps the post-surcharge increase to income over the threshold. Affects only high earners near ₹50L+; irrelevant to the ₹8–18L target user. Also: no marginal relief modeled except the new-regime 87A taper above ₹12L. Fix if the product moves upmarket.
