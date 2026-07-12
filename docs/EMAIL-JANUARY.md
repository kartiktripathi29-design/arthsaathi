# EMAIL-JANUARY.md — the one email we promised

**What this is:** the single reactivation email sent ~Jan 10 to everyone captured on
/try. It is the payoff of the capture form's promise ("One email in January. Nothing
else."). Sender: **ArthVo**. One send, one reminder — breaking that promise costs more
than the email earns.

---

## Send details

- **From:** ArthVo <hello@arthvo.com>
- **When:** ~10 January (after Sankranti planning mood starts, ~11 weeks before Mar 31)
- **Audience:** all captures with unsubscribed=false
- **One send only.** No follow-up, no drip. The restraint IS the brand.

---

## Variant A — personalized (verdictAmount exists)

**Subject:** You have 11 weeks.
**Preheader:** The one email we promised — the month your tax can still change.

Body:

> In July, you found out you could have saved **₹{verdictAmount}** last year.
>
> That year was already closed. Nothing could be done — which is the worst kind of
> finding out.
>
> This year is different, for exactly 11 more weeks. Until 31 March, every rupee of
> that gap is still fixable: the deductions you didn't finish, the regime you didn't
> compare, the claims you didn't know were yours.
>
> One click shows what's still open — from your own numbers, with nothing to sell you
> at the end.
>
> **[ See what's still fixable ]** → arthvo.com/try?r={token}
>
> —
> This is the one email we promised in July. There won't be another.
> [Unsubscribe] — one click, no questions.

## Variant B — generic (no verdictAmount stored)

**Subject:** You have 11 weeks.
**Preheader:** The one email we promised — the month your tax can still change.

Body:

> In July, you checked your tax and wondered what you'd missed.
>
> By then the year was closed — the worst time to find out is when nothing can be done.
>
> Right now is the opposite. Until 31 March, this year is still open: deductions you
> haven't finished, a regime you haven't compared, claims you didn't know were yours.
>
> One click shows what's still fixable — from your own numbers, with nothing to sell
> you at the end.
>
> **[ See what's still fixable ]** → arthvo.com/try?r={token}
>
> —
> This is the one email we promised in July. There won't be another.
> [Unsubscribe] — one click, no questions.

---

## Subject line alternates (A/B if volume permits)

1. **You have 11 weeks.** ← recommended: urgency without fear, no tax jargon
2. The email we promised you.  ← trades urgency for trust; strong open-rate candidate
3. ₹{verdictAmount} is still on the table. ← highest punch, personalized-only,
   slightly riskier tone for a restraint brand

## Rules honored (do not violate in future edits)

- No emoji, sentence case, no tax-year string (say "this year"/"31 March", never "FY XX-XX")
- No product recommendations, no urgency-manufacturing beyond the real deadline
- The "one email" promise is stated inside the email itself — self-enforcing
- Unsubscribe is one click, works, and is never guilt-tripped

## Technical requirements (for the capture build)

1. Store **verdictAmount** at capture time (else Variant B for that user)
2. Store **capturedAt** and source — the email references "in July"; if captures happen
   in other months, swap the phrase for "when you last checked" (template conditional)
3. Provider: not chosen yet (Resend / SES). Needs: template variables, one-click
   unsubscribe header (RFC 8058), unguessable token link → existing route
4. CTA link format: **arthvo.com/try?r={token}** (the capture's unguessable token).
   /try preserves returning-user context cross-device — it GETs
   /api/email-capture/context?r={token} (returns only verdictFY + verdictAmount for a
   non-unsubscribed capture) and shows the returning-user banner, so a click from
   another device lands on "here's your gap" not a cold start. Local verdict wins if present.
