# ArthVo theming — locked decisions (2026-06-10 session)

- Default: follow system preference (`prefers-color-scheme`). No top-bar toggle.
- Override: three-way Appearance control (System / Light / Dark) in the account menu. Persisted. Applied before first paint (inline script sets the class pre-render — no light-then-dark flash).
- Implementation requires PAIRED TOKENS: every token in `src/lib/tokens.ts` needs a dark counterpart designed against the current wheat/teal canon (NOT the older emerald exploration — that predates the current palette).
- Scope: `app/dashboard` track first (the account menu lives there); landing inherits via tokens afterward.
- Status: implemented for the app track (D1–D1.5) — system default + three-way control, full surface audit, input color + color-scheme, on-teal pair. Landing still light (dark-mode treatment queued — daylight mockup first, must preserve the wheat→CTA arc, not a flat invert). Dark palette = first draft; tuning round + token-family trios (danger/pink/inferred-blue) pending.

## Dark-mode surface rules (enforced)

1. Every card/panel/summary surface declares `background: T.card` explicitly — never relies on default white, transparent inheritance from a non-card parent, or a bare hex.

2. Every `input`/`select`/`textarea` sets BOTH:
   - `background` explicitly — `T.card` if standalone-bordered, `'transparent'` if inside an already-tokenized ₹-box wrapper; and
   - `color: T.text` (`C.text`) explicitly — native form text defaults to UA black and does NOT inherit page color.

   Plus, globally: `:root` declares `color-scheme: light` and `[data-theme="dark"]` declares `color-scheme: dark` — this is what flips native chrome (caret, text-selection highlight, `<select>` dropdown popup, autofill) that CSS `color` cannot reach. Background alone is never sufficient; color alone leaves a light caret/dropdown; both + `color-scheme` is the complete fix.

3. Semantic boxes (info / amber / success / tint) use the token families (`slip` / `caution` / `tint`), never raw hex.

4. Label-on-fill uses `T.onTeal` on any teal / `C.fg` ground — never raw `'#fff'` or `T.ivory` on a fill that lightens in dark mode. (`T.ivory` stays only on grounds that DON'T lighten: the deep-teal brand cap, and danger-red.)

5. Known exceptions (until the `tokens.ts` pass formalizes their dark trios): danger `#B94040`, the pink `#FBF0F0` danger-fill, and the inferred-blue source-state set (`#CFE0F0` / `#1F4E7A` / `#7AA8D1`) — logged token-family debt, intentionally un-flipped; they render as light patches in dark mode by design until then.

Audit method (string-match alone misses white-by-default — this is why three separate sweeps missed surfaces):
- grep `'#fff'` / `'#ffffff'` / `'white'` (all casings), AND
- scan every `input`/`select`/`textarea` for missing `background` OR missing `color`, AND
- check `background:'transparent'`/unset on page-level surfaces (they inherit white from a non-card parent), AND
- bare white-ish hexes inside `border` / `boxShadow` / `backgroundImage` shorthands.
