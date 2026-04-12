# ArthSaathi 🇮🇳
**AI-Powered Financial Companion for India's Working Class**

SEBI RIA-backed · Next.js 16 · Anthropic Claude API · TypeScript · Recharts

---

## What's Built

| Route | What it does |
|---|---|
| `/` | Landing page with feature overview |
| `/dashboard` | Overview: KPI cards, income pie chart, tax regime bar chart |
| `/dashboard/salary` | Drag-and-drop salary slip upload → Claude Vision parsing → take-home breakdown |
| `/dashboard/tax` | Old vs New regime comparison · slab chart · deduction maximiser · Form 12BB guide |
| `/dashboard/invest` | AI investment plan · allocation pie · 20-year corpus area chart · health score |
| `/dashboard/chat` | Streaming AI advisor · context-aware · markdown rendering · quick prompts |

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Set env
cp .env.example .env.local
# Edit .env.local — add your key:
# ANTHROPIC_API_KEY=sk-ant-api03-...

# 3. Run
npm run dev
# → http://localhost:3000
```

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                     Landing page
│   ├── layout.tsx                   Root layout + Toaster
│   ├── globals.css                  Brand tokens + animations
│   ├── dashboard/
│   │   ├── layout.tsx               Sidebar nav + top bar
│   │   ├── page.tsx                 Overview (pie + bar charts)
│   │   ├── salary/page.tsx          Upload + parse + breakdown
│   │   ├── tax/page.tsx             Regime comparison (3 tabs)
│   │   ├── invest/page.tsx          Plan + area chart + health ring
│   │   └── chat/page.tsx            Streaming AI chat
│   └── api/
│       ├── parse-salary/route.ts    POST → Claude Vision parsing
│       ├── tax-calc/route.ts        POST → Tax engine
│       ├── chat/route.ts            POST → SSE streaming chat
│       └── invest/route.ts          POST → Investment plan
├── components/
│   └── ui.tsx                       StatCard, Card, Badge, InfoBox,
│                                    PillTabs, ProgressRow, EmptyState
├── lib/
│   ├── claude.ts                    Anthropic SDK: parse + chat + invest
│   ├── tax-engine.ts                AY 2025-26 tax engine (both regimes)
│   └── db.ts                        Stub — swap for Prisma/Supabase
├── store/
│   └── AppStore.tsx                 React Context + localStorage state
└── types/
    └── index.ts                     All TypeScript interfaces
```

---

## Tax Engine — AY 2025-26

**Old Regime slabs:** 0% / 5% / 20% / 30%
- Deductions: 80C (₹1.5L) · 80CCD(1B) NPS (₹50K) · 80D (₹50K) · Sec 24(b) (₹2L)
- HRA exemption: min(actual HRA, 50%/40% basic, rent − 10% basic)
- Standard deduction: ₹50,000
- Rebate 87A: up to ₹12,500 if income ≤ ₹5L
- Surcharge: 10% / 15% / 25% / 37% by income band
- Cess: 4%

**New Regime slabs:** 0% / 5% / 10% / 15% / 20% / 30%
- Standard deduction: ₹75,000
- Rebate 87A: up to ₹25,000 if income ≤ ₹7L (effectively zero tax)
- No other deductions

---

## Claude Integration

| Use | Model | Purpose |
|---|---|---|
| Salary parsing | `claude-opus-4-5` | Multimodal Vision — reads PDFs and images |
| Investment plan | `claude-sonnet-4-5` | Structured JSON plan generation |
| Chat | `claude-sonnet-4-5` | Streaming financial Q&A |

The chat system prompt includes SEBI disclaimers, Indian tax law context, and the user's actual salary/tax data for hyper-personalised answers.

---

## Salary Parser — Supported Formats

- Any PDF payslip (single or multi-page)
- JPG / PNG / WebP photos of printed payslips
- IT sector (multi-component), PSU, SME, startup, contractor formats
- Extracts: Basic · HRA · DA · TA · LTA · Medical · Special Allowance · PF · ESIC · PT · TDS · Net Pay · CTC · Employer PF

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — required |
| `DATABASE_URL` | `file:./dev.db` for SQLite (replace for Postgres in prod) |

---

## Path to Production

| Item | Action |
|---|---|
| **Database** | Replace `src/lib/db.ts` with Prisma + Supabase (schema in `prisma/schema.prisma`) |
| **Auth** | Add Clerk or NextAuth for user accounts |
| **Payments** | Razorpay for ₹499/mo subscription |
| **MF execution** | BSE StAR MF API for direct plan purchase |
| **Data residency** | Deploy on AWS Mumbai `ap-south-1` (DPDP Act compliance) |
| **SEBI filing** | Obtain RIA registration; add 5-year advice audit log |
| **ITR e-filing** | Apply for ERI (e-Return Intermediary) license (V2) |

---

## Compliance

> ArthSaathi is designed to operate under SEBI Investment Adviser Regulations 2013 (amended 2020). All AI-generated investment responses carry mandatory SEBI disclaimers. Tax calculations are indicative — users are directed to consult a CA for ITR filing. No salary document is persisted beyond the session. DPDP Act 2023 consent flows are built into the upload UX.

---

*अर्थसाथी — Built for India's 500 million working people.*
