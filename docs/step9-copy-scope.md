# Step 9 — Plain-English Copy Pass (scope)

Status: PENDING final approval on the items marked [PENDING].
Principle: plain-English on INPUTS and the VERDICT; keep statutory precision on the COMPUTATION/PROOF so users can verify against official tax documents.
Carve-out: never rename "exemption"/"deduction"/section numbers where they are the correct legal term inside an explanation. Only rename product labels/options that are opaque to a layperson.

## REWRITE (opaque primary-text jargon)
- Other earnings (other-income/page.tsx): 6 menu labels + descriptions, freelance declaration toggle, AIS banner scope sentence. [PENDING 5 final calls: crypto desc, trading label, stocks/trading descriptions, freelance desc length, AIS banner wording]
- Deductions (deductions/page.tsx): 80G donation dropdown + bucket/eligibility wording ("100% / No limit / 10% AGTI cap" -> plain). [PENDING]
- Allowances (exemptions/page.tsx): two headlines still leading with jargon -> plain questions. "Superannuation fund contribution" (~:493), "PF withdrawal on retirement / separation" (~:504). [PENDING]
- Salary (salary/page.tsx): "Override" (~:1615) -> "Edit manually". [PENDING]
- Tagline / wordmark — replace "Wealth Evolved" everywhere, sized to placement (3 tiers):
  - Tier 1 (tight in-app chrome): wordmark "ArthVo" ALONE, no descriptor. Locations: dashboard/layout.tsx:66 (sidebar cap), page.tsx:98 (landing nav), offer/page.tsx:97 (offer nav).
  - Tier 2 (first-touch / orientation):
    - Auth screens + password gate show the wordmark ALONE, no tagline (matches in-app nav chrome). Locations: signup/page.tsx, login/page.tsx, components/PasswordGate.tsx. The auth/gate descriptor was tried and removed — auth users already know the product; descriptor now lives only in metadata.
    - Metadata / browser tab -> "ArthVo — your income tax, in plain English". Location: layout.tsx:11.
  - Tier 3 (landing hero brand line + enlarged centred logo): DEFERRED to the landing rebuild / Phase-2. The Phase-1 lines above are functional descriptors, NOT the permanent brand tagline.
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
