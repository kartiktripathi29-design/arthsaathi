# Salary Parsing — Fundamentals Prompt

Source branch: `feature/db-persistence-clean` (this is the reference implementation).
Target: apply these same fundamentals to any other branch (e.g. `feature/next-changes`).

## What "salary parsing" means in this app

A user uploads one document (image or PDF, possibly multi-page). The server:
1. Splits a multi-page PDF into N single-page PDFs.
2. Sends each page to Claude in parallel for structured JSON extraction.
3. Falls back to whole-PDF parsing if every per-page parse comes back empty.
4. Returns the array of parsed slips.
5. Asynchronously persists each slip to Postgres and logs an activity event (fire-and-forget; client never waits on DB).

## Non-negotiable behaviors

### A. PDF handling
- Load PDF with `PDFDocument.load(bytes, { ignoreEncryption: true })`. Many Indian payroll PDFs (Zoho, Razorpay, Keka) set the encryption flag without a real password — pdf-lib refuses these by default; we accept them.
- Cap pages at `MAX_PAGES = 6`. Reject PDFs over this with 422 and a clear message.
- If split throws (rare, non-standard PDFs), fall back to sending the whole PDF as one parse instead of failing.

### B. Parsing
- Run all pages through `Promise.allSettled` — never `Promise.all`. One bad page must not poison the others.
- Use `parseSalaryFromBase64` from `@/lib/claude` for every page.
- After settling, keep only slips with a usable `grossSalary || netSalary`.
- **Whole-PDF fallback**: if every per-page result is unusable AND we did split a multi-page PDF, retry once by sending the entire PDF. Some slips span pages (earnings on page 1, totals on page 2) and only make sense as a whole.

### C. Post-processing
For each valid slip, if Claude omitted derived fields, compute them:
- `ctcMonthly = grossSalary + employerPF`, `ctcAnnual = ctcMonthly * 12` (when `ctcMonthly` is missing and `grossSalary` exists).
- `netSalary = grossSalary - totalDeductions` (when `netSalary` is missing and `grossSalary` exists).

### D. Claude prompt (SALARY_PARSE_SYSTEM)
- Role: "precise Indian payroll document parser. Extract ALL salary components from any Indian payslip — regardless of format, employer, or layout."
- Output: ONLY valid JSON, no markdown.
- Exact schema (numeric fields, 0 if absent):
  `employeeName, employerName, month, year, basicSalary, hra, da, ta, lta, medicalAllowance, specialAllowance, otherAllowances, grossSalary, employeePF, employerPF, esic, professionalTax, tdsDeducted, loanDeduction, otherDeductions, totalDeductions, netSalary, ctcMonthly, ctcAnnual, components[]`
- `components` items: `{ label, amount, type: "earning" | "deduction" | "computed" }`.
- Rules in the prompt:
  - INR amounts as bare numbers (no symbols).
  - Missing field → 0.
  - `grossSalary` = sum of earnings before deductions; trust the printed gross if line items don't sum.
  - `netSalary` = take-home (grossSalary − totalDeductions).
  - `ctcMonthly` = grossSalary + employerPF + ESIC employer share + gratuity provision.
  - Include EVERY visible line item in `components`.
  - List common Indian allowances/deductions explicitly in the prompt (Basic, HRA, DA, TA/Conveyance, LTA, Medical, Special, Night Shift, Statutory Bonus / PF, ESIC, Professional Tax, TDS, Loans, Salary Advance).

### E. Claude call
- Model: `claude-sonnet-4-6` (Sonnet 4.6 — faster than Opus, accurate enough for payslips).
- `max_tokens: 1200`.
- Image input → `type: "image"` block.
- PDF input → `type: "document"` block with `media_type: "application/pdf"`.
- User text:
  - image: `'Parse this Indian salary slip and return the JSON as specified. Extract every number you can see accurately.'`
  - PDF: `'Parse this Indian salary slip PDF and return the JSON as specified.'`
- Extract the JSON via `text.match(/\{[\s\S]*\}/)`; throw if no match.

### F. Persistence (fire-and-forget after response)
- Build the JSON response object first, then `Promise.resolve().then(async () => { ... })` for DB writes. **Never await DB writes inside the request flow** — slow DB must not slow the user.
- For each valid slip with `netPay > 0`:
  - `period = slip.payPeriod || (current YYYY-MM-01)`
  - `prisma.salarySlip.upsert` on composite key `userId_periodMonth` with fields `employer`, `netPay`, `components` (JSON-cloned from the slip).
  - User identity: `'anonymous'` for now (real auth user-id wires in later).
- After all slips: `logActivity('anonymous', 'SALARY_PARSE_SUCCESS', null, { count, netPay })`.
- Wrap the whole block in try/catch. DB failure is logged, never returned.

### G. Errors
- 400 if missing `base64Data`/`mediaType`.
- 400 for unsupported media type.
- 422 if PDF is unreadable, empty, or over `MAX_PAGES`.
- 422 if zero valid slips after parsing (include the per-page error details).
- 500 catch-all with the error message.
- Log `[parse-salary]` prefixed messages for: page count, per-page parse outcome (gross/net/month), failed pages, fallback attempts, DB write errors.

## Required supporting modules

### `src/lib/db.ts`
Singleton PrismaClient using `@prisma/adapter-pg` with `DATABASE_URL`. Cache on `globalThis` outside production.

### `src/lib/activity.ts`
- `logActivity(userId, eventType, targetId?, metadata?)` — wraps `prisma.activityEvent.create`, swallows errors with a `[activity-log]` console error.
- Convenience helpers: `logLogin`, `logClassification`.

### Prisma schema (relevant models)
- `SalarySlip { id, userId, periodMonth (TIMESTAMP), employer (nullable), components (JSONB), netPay (Decimal 14,2), createdAt, updatedAt }` with unique composite index on `(userId, periodMonth)` and a non-unique index on the same pair (for lookups).
- `ActivityEvent { id, userId, eventType (EventType enum), targetId (nullable), metadata (JSONB default {}), createdAt }` with indexes on `(userId, createdAt)`, `(userId, eventType)`, `(eventType, createdAt)`.
- `EventType` enum must include `SALARY_PARSE_SUCCESS`, `SALARY_PARSE_FAIL`, `SALARY_UPLOAD` (and any others the app uses).

## Application prompt (paste this when modifying a target branch)

> Bring the salary-parsing fundamentals from `feature/db-persistence-clean` into THIS branch. Concretely:
>
> 1. **`src/lib/claude.ts` → `SALARY_PARSE_SYSTEM`**: replace the system prompt with the version that:
>    - Frames the role as "precise Indian payroll document parser… regardless of format, employer, or layout."
>    - Uses the compact JSON schema (field names as listed above, no inline parenthetical descriptions).
>    - Lists rules including the explicit allowance/deduction families and the "trust the printed gross" rule.
> 2. **`src/lib/claude.ts` → `parseSalaryFromBase64`**: model `claude-sonnet-4-6`, `max_tokens: 1200`. Use the per-mode user-text variants above. Extract JSON with the regex match; throw on no match.
> 3. **`src/app/api/parse-salary/route.ts`**:
>    - Multi-page PDF splitter with `MAX_PAGES = 6`, `ignoreEncryption: true`, try/catch around split with whole-PDF fallback.
>    - `Promise.allSettled` over `parseSalaryFromBase64` per page.
>    - Filter to `(grossSalary || netSalary)`.
>    - Empty-results whole-PDF fallback retry.
>    - Post-process: derive `ctcMonthly/ctcAnnual` and `netSalary` if missing.
>    - Build response first, then fire-and-forget `Promise.resolve().then(async () => { ... })` for `prisma.salarySlip.upsert` per slip + `logActivity('anonymous', 'SALARY_PARSE_SUCCESS', …)`.
>    - Return response. Catch-all 500 at the outer try.
> 4. **`src/lib/db.ts`, `src/lib/activity.ts`, Prisma schema/migration, generated client**: if the branch does not yet have these, add them (mirror what's on `feature/db-persistence-clean`). The persistence call in step 3 depends on them.
> 5. **Install deps if missing**: `@prisma/adapter-pg`, `pg`.
>
> Do NOT change client UI flows — the route's response shape (`{ success, data: ParsedSalaryData[], count, skipped, errors? }`) must stay identical so existing callers keep working.
