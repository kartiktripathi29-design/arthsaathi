# January reminder email — DRAFT (STUB)

> **STUB — founder copy owed.** This is a scaffold, not the final email. Do not ship the
> placeholder text below. Replace each `TODO` with the approved copy (attach the final
> draft to have it committed verbatim).

## Context
- The single January reminder for people who captured their email on the `/try` verdict.
- **No tax-year strings in user-facing copy** unless they come from the FY resolver.
- **No emoji.** Sentence case.

## Per-recipient data available (from `EmailCapture`)
- `verdictAmount` — the could-have-saved figure they saw on `/try` at capture time (may be null).
- `verdictFY` — the FY the verdict was computed on (resolve to a label via the FY resolver; never hardcode a year).
- `capturedAt` — when they captured.
- `unsubscribeToken` — for the one-click unsubscribe link.

## Subject line
TODO: founder copy.

## Preview text
TODO: founder copy.

## Body
TODO: founder copy. (Personalization hook: the could-have-saved figure — `verdictAmount`.)

## Call to action
TODO: founder copy. Link target: TODO.

## Footer / unsubscribe (required)
TODO: founder copy, and it MUST include the one-click unsubscribe link:

`https://arthvo.com/unsubscribe?token=<unsubscribeToken>`

Suggested footer line (already used at capture): "One reminder email. Unsubscribe with one click. No marketing."
