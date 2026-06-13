# ArthVo theming — locked decisions (2026-06-10 session)

- Default: follow system preference (`prefers-color-scheme`). No top-bar toggle.
- Override: three-way Appearance control (System / Light / Dark) in the account menu. Persisted. Applied before first paint (inline script sets the class pre-render — no light-then-dark flash).
- Implementation requires PAIRED TOKENS: every token in `src/lib/tokens.ts` needs a dark counterpart designed against the current wheat/teal canon (NOT the older emerald exploration — that predates the current palette).
- Scope: `app/dashboard` track first (the account menu lives there); landing inherits via tokens afterward.
- Status: implemented for the app track (D1) — system default + account-menu override; landing still light, inherits later. Dark palette = first draft, tuning round pending.
