# Step 9 — Plain-English Copy Pass (scope)

Status: PENDING final approval on the items marked [PENDING].
Principle: plain-English on INPUTS and the VERDICT; keep statutory precision on the COMPUTATION/PROOF so users can verify against official tax documents.
Carve-out: never rename "exemption"/"deduction"/section numbers where they are the correct legal term inside an explanation. Only rename product labels/options that are opaque to a layperson.

## REWRITE (opaque primary-text jargon)
- Other earnings (other-income/page.tsx): 6 menu labels + descriptions, freelance declaration toggle, AIS banner scope sentence. [PENDING 5 final calls: crypto desc, trading label, stocks/trading descriptions, freelance desc length, AIS banner wording]
- Deductions (deductions/page.tsx): 80G donation dropdown + bucket/eligibility wording ("100% / No limit / 10% AGTI cap" -> plain). [PENDING]
- Allowances (exemptions/page.tsx): two headlines still leading with jargon -> plain questions. "Superannuation fund contribution" (~:493), "PF withdrawal on retirement / separation" (~:504). [PENDING]
- Salary (salary/page.tsx): "Override" (~:1615) -> "Edit manually". [PENDING]
- Master tagline "Wealth Evolved" -> [PENDING pick]. 7 locations: layout.tsx:11, dashboard/layout.tsx:66, page.tsx:98, offer/page.tsx:97, signup/page.tsx:38, login/page.tsx:37, components/PasswordGate.tsx:61.
- Optional: spell out AIS / CTC / TDS once at first use.

## LEAVE PRECISE (do NOT rewrite)
- All grey statutory sub-labels under plain headlines (the Step-5 demotion).
- Your Tax (optimizer) computation breakdown: 87A rebate, surcharge, Health & Edu cess, Chapter VI-A, LTCG/STCG, slab-wise tables.
- ITR quick-reference + dynamic ITR reasons.
- Offer page component rows (HRA / LTA / ESOP / PF) — they mirror the actual offer letter the user is decoding.

## NOT IN THIS STEP
- Landing page claims/calculator/UI — moved to its own step (see landing-rebuild.md). Only the global tagline swap touches the landing here. [PENDING: confirm whether landing tagline instance is in Step 9 or deferred]

## LOGGED FOR LATER (separate, non-copy)
- Save validation: block saving empty/zero income entries (PRE-LAUNCH, ~10-line guard on handleSave in other-income).
- Question-based Stocks vs Trading routing (Phase-2) — eliminates misclassification vs. only warning.
- AIS coverage expansion to rental/other income (Phase-2).
- ui.tsx slate-grey -> token folding; dead navy CSS pruning.
