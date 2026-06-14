# Privacy & Data-Handling Findings

> Status: OPEN. Found via read-only code audit during the landing rebuild. These are real gaps between what the product CLAIMS and what the code DOES. Needs founder + likely legal (DPDP) review. Not a UI/copy task — copy cannot fix these.

## 1. The existing privacy page makes FALSE claims (live now)
- Claims parsed salary numbers are "saved only in your browser… never sent to our database" — FALSE. parse-salary writes parsed figures to the `salarySlip` DB table (plaintext) for any signed-in user (parse-salary/route.ts upsert).
- Claims "you can delete all your data anytime" — FALSE. There is NO server-side delete. The only "clear/reset" wipes localStorage (AppStore.tsx clearAll/logout); DB rows and stored files persist.
- Does not clearly disclose that document content is sent to a third-party AI (Anthropic) to be parsed.
- IMPACT: false privacy claims are live to users today; highest-priority correction.

## 2. No server-side deletion mechanism (DPDP gap)
- No DELETE API route, no prisma delete/deleteMany anywhere. user-data route exposes only GET + PUT.
- "Sign out / Reset" clears the browser only. salarySlip rows, encrypted userData blob, and stored bank-statement blobs all survive.
- DPDP (India) generally requires a real data-deletion path. Currently absent.

## 3. Salary figures stored in plaintext
- salarySlip table stores userId, periodMonth, employer, netPay, and the full parsed slip JSON in plaintext (not encrypted at rest). (The separate userData blob IS encrypted; salarySlip is not.)

## 4. Bank statements (≥4MB) persist in Vercel Blob, never deleted
- Files ≥4MB upload to Vercel Blob (access: private) before parsing (dashboard/profile/page.tsx). blob-upload route's onUploadCompleted only console.logs — no deletion after parsing. So large bank statements accumulate in Blob storage indefinitely.
- (Salary slips & AIS <4MB are parsed in-memory and discarded — those are fine.)

## 5. Auth is password-based, not OTP-only
- login uses supabase signInWithPassword (email+password / phone+password). OTP is used only for signup verification and password reset. So Supabase stores a (hashed) password. Any "OTP-only, no password" claim would be false.

## 6. Third-party data flow (must be disclosed, not hidden)
- Document content (slip/AIS/bank statement image, PDF, or text) is sent to Anthropic (Claude API) to parse — every parse path. claude.ts client.messages.create.
- Supabase: stores email/phone + password hash + sessions. Vercel: hosting, Blob storage, analytics.
- Honest disclosure must name that documents are read by an external AI service and list processors.

## What's safe to say today (true)
- Salary slips & AIS are parsed in-memory and discarded (the FILE isn't kept; <4MB).
- We don't sell user data.
- Extracted figures are saved to the user's account (so a "your data is stored" framing is honest; "browser-only" is not).

## Required actions (not copy)
- [ ] Correct the live privacy page to match reality (remove false storage/delete claims; disclose AI/processors). HIGH PRIORITY — false claims are live.
- [ ] Build a real server-side delete / data-export path (DPDP).
- [ ] Decide on encryption-at-rest for salarySlip plaintext.
- [ ] Add deletion of Vercel Blob bank statements after parsing.
- [ ] Founder + legal review for DPDP compliance before public launch.
- [ ] Any landing privacy copy must stay within "What's safe to say today" until the above are fixed.
