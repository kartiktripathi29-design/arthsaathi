# ArthVo 🇮🇳

**Read your salary slip. Compare tax regimes. Know what you actually owe.**

Next.js · Anthropic Claude API · TypeScript

ArthVo is an informational tool for salaried individuals in India. It parses your
salary slip (and AIS / 26AS / bank / CAS documents), works out your income picture,
and compares the old vs new tax regime so you can see which one costs you less.

> **Not financial or investment advice.** ArthVo is not a registered investment
> adviser. Tax figures are illustrative — consult a CA for ITR filing.

---

## What's in Phase 1 (live)

| Route | What it does |
|---|---|
| `/` | Landing page |
| `/signup`, `/login` | Email / phone + OTP auth (Supabase; mock fallback when unconfigured) |
| `/offer` | Standalone offer-letter decoder — CTC breakdown + take-home estimate |
| `/dashboard/profile/documents` | Upload salary slip / AIS / 26AS → Claude parsing |
| `/dashboard/profile/salary` | Month-by-month salary timeline + take-home breakdown |
| `/dashboard/profile/other-income` | Non-salary income (freelance, interest, capital gains) |
| `/dashboard/profile/exemptions` | Section-10 allowances (HRA, LTA, etc.) |
| `/dashboard/profile/deductions` | Chapter VI-A deductions (80C, 80D, 24(b), NPS…) |
| `/dashboard/tax/optimizer` | Old vs New regime comparison · slab-wise breakup · refund/payable · which ITR |

## Parked for Phase 2 (code present, routes hidden)

The investment planner, AI advisor chat, financial-DNA quiz, and affordability tool
live under `/dashboard/{invest,chat,dna,decide}`. They are **guarded** — each redirects
to the documents page — and are kept out of the nav. Search the codebase for
`// PHASE-2: remove this guard to re-enable` to lift them. The bank-statement /
transaction-intelligence / demat-CAS parsing engine is also present and used by the
profile flow.

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY=sk-ant-...
npm run dev                  # → http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — required for document parsing |
| `NEXT_PUBLIC_SUPABASE_URL` / key | Supabase auth (optional — mock auth runs without it) |

---

## Tax Engine — AY 2025-26

**Old Regime:** 0% / 5% / 20% / 30% · standard deduction ₹50,000 · 87A rebate ≤ ₹5L ·
Chapter VI-A deductions (80C ₹1.5L · 80CCD(1B) NPS ₹50K · 80D · 24(b) ₹2L) ·
HRA exemption = min(actual HRA, 50%/40% basic, rent − 10% basic) · cess 4%.

**New Regime:** 0% / 5% / 10% / 15% / 20% / 30% · standard deduction ₹75,000 ·
87A rebate ≤ ₹7L · no other deductions · cess 4%.

Capital gains and crypto are taxed at their own statutory rates and added to both regimes.

---

## Privacy

Salary documents are parsed in-session and not persisted to a server database. Parsed
figures are stored in your browser's localStorage (with optional cloud backup when
signed in). See `/privacy` for the full policy.
