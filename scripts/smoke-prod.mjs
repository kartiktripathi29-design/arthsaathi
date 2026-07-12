// Production smoke test — asserts the launch-critical paths on the live site and exits 0 (all pass)
// or 1 (any fail). Safe to run against production: the one write it makes (an email capture with a
// throwaway example.com address) is deleted again before the script exits.
//
// Usage:
//   node scripts/smoke-prod.mjs [baseUrl]
//   SMOKE_BASE_URL=https://www.arthvo.com node scripts/smoke-prod.mjs
//
//   baseUrl        defaults to https://www.arthvo.com (arg > SMOKE_BASE_URL env > default)
//   DATABASE_URL   used to confirm the capture row was created and to clean it up. Read from the
//                  environment, falling back to .env.local. Without it, the capture round-trip is
//                  SKIPPED (no row is created, so nothing is left behind) and the rest still runs.
//
// Requires: Node 18+ (global fetch) and the `pg` package (already a dependency) for the DB checks.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://www.arthvo.com').replace(/\/$/, '')
const TEST_EMAIL = `prod-smoke-${Date.now()}@example.com`

// DATABASE_URL: env first, then .env.local next to the repo root.
function resolveDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const env = readFileSync(join(root, '.env.local'), 'utf8')
    const m = env.match(/^DATABASE_URL=(.*)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  return null
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const skip = (name, why) => {
  results.push({ name, ok: true, skipped: true })
  console.log(`SKIP  ${name}  — ${why}`)
}

async function status(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function main() {
  console.log(`\nSmoke test → ${BASE}\n`)

  // 1–2. Public pages load.
  check('GET /  → 200', (await status('GET', '/')).status === 200)
  check('GET /try  → 200', (await status('GET', '/try')).status === 200)

  // 3. Context endpoint rejects a bad token with 404 (no info leak).
  check('GET /api/email-capture/context?r=<bad>  → 404',
    (await status('GET', '/api/email-capture/context?r=not-a-real-token-000000000')).status === 404)

  // 4. parse-salary must fail *validation* (400), not crash (500), on an empty body.
  {
    const s = (await status('POST', '/api/parse-salary', {})).status
    check('POST /api/parse-salary {}  → 400 (not 500)', s === 400, `got ${s}`)
  }

  // 5. Gated Phase-2 routes stay dark (404) while PHASE_2_ENABLED is false.
  for (const path of ['/api/parse-bank-statement', '/api/parse-cas/save', '/api/parse-cas/token']) {
    const s = (await status('POST', path, {})).status
    check(`POST ${path}  → 404 (gated)`, s === 404, `got ${s}`)
  }

  // 6. Capture → context(valid) → unsubscribe round-trip → cleanup. Needs the DB to read the token
  //    (the capture POST deliberately never returns it) and to delete the row afterward.
  const dbUrl = resolveDbUrl()
  if (!dbUrl) {
    skip('capture → unsubscribe round-trip', 'no DATABASE_URL / .env.local — capture write skipped so nothing is orphaned')
  } else {
    const client = new pg.Client({ connectionString: dbUrl })
    await client.connect()
    let created = false
    try {
      const post = await status('POST', '/api/email-capture', { email: TEST_EMAIL, verdictFY: 2025, verdictAmount: 12345 })
      check('POST /api/email-capture  → 200 {ok:true}', post.status === 200 && (await post.json()).ok === true)

      const row = (await client.query(
        'SELECT "unsubscribeToken","verdictFY","verdictAmount","unsubscribed" FROM "EmailCapture" WHERE email=$1', [TEST_EMAIL])).rows[0]
      created = !!row
      check('capture row created in DB', created)
      if (!created) throw new Error('no row — cannot continue capture flow')
      const token = row.unsubscribeToken

      const ctx = await status('GET', `/api/email-capture/context?r=${encodeURIComponent(token)}`)
      const ctxBody = ctx.status === 200 ? await ctx.json() : null
      check('context(valid token)  → 200 with exactly {verdictFY, verdictAmount}',
        ctx.status === 200 && ctxBody && ctxBody.verdictFY === 2025 && ctxBody.verdictAmount === 12345 &&
        Object.keys(ctxBody).sort().join(',') === 'verdictAmount,verdictFY')

      const unsub = await status('GET', `/unsubscribe?token=${encodeURIComponent(token)}`)
      const unsubHtml = await unsub.text()
      check('GET /unsubscribe?token=<valid>  → 200 + confirmation',
        unsub.status === 200 && /unsubscribed/i.test(unsubHtml))

      const dbUnsub = (await client.query('SELECT unsubscribed FROM "EmailCapture" WHERE email=$1', [TEST_EMAIL])).rows[0]
      check('DB row marked unsubscribed', dbUnsub?.unsubscribed === true)

      const ctx2 = await status('GET', `/api/email-capture/context?r=${encodeURIComponent(token)}`)
      check('context(unsubscribed token)  → 404 (no rehydrate)', ctx2.status === 404)
    } finally {
      if (created) {
        const del = await client.query('DELETE FROM "EmailCapture" WHERE email=$1', [TEST_EMAIL])
        check('cleanup: test capture row deleted', del.rowCount === 1)
      }
      await client.end()
    }
  }

  const failed = results.filter(r => !r.ok)
  const passed = results.filter(r => r.ok && !r.skipped).length
  const skipped = results.filter(r => r.skipped).length
  console.log(`\n${failed.length ? 'FAILED' : 'OK'} — ${passed} passed, ${failed.length} failed, ${skipped} skipped\n`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('\nSmoke test crashed:', err); process.exit(1) })
