# scripts/

Developer/maintenance scripts. These are **not** part of the app build — run them
manually with `node scripts/<name>.mjs`.

| Script | Purpose |
| --- | --- |
| `apply-userdata-rls.mjs` | One-off (idempotent): enable RLS + owner policy on the `UserData` table (Supabase Security Advisor fix). Connects via `DIRECT_DATABASE_URL`. |
| `gatewalk.mjs` | Proto gate-walk screenshot driver — raw CDP over the DevTools WebSocket (no deps). Launches headless Chrome, seeds localStorage, walks each route at a given theme/width, writes a PNG per scenario. Output lands in `gatewalk-shots/` (gitignored). |
| `probe-f4.mjs` | F4 regression probe — verifies `av_deductions.ppf` survives a visit to the deductions page and that the live "saves" figure agrees across `/start` and `/deductions` for identical seeded data. |
| `probe-f4b.mjs` | F4b probe — samples the deductions page right after navigation to catch the mount-time write-back flicker. |
| `lintscope.mjs` | Reads `eslint . --format json` from stdin and reports problem counts grouped by non-src file. Usage: `npx eslint . --format json \| node scripts/lintscope.mjs`. |
