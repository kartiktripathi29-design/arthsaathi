import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEmail, isValidEmail, checkRateLimit,
  captureEmail, unsubscribeByToken, submitCapture,
} from './email-capture.ts'

// Fake CaptureStore — in-memory, upsert by email; token set on CREATE only (mirrors the Prisma route).
function makeFakeStore() {
  const byEmail = new Map()
  let seq = 0
  return {
    byEmail,
    async upsert(i) {
      const existing = byEmail.get(i.email)
      if (existing) { existing.verdictFY = i.verdictFY; existing.verdictAmount = i.verdictAmount } // keep token
      else byEmail.set(i.email, { ...i, unsubscribeToken: 'tok_' + String(++seq).padStart(20, '0'), unsubscribed: false })
    },
    async markUnsubscribed(token) {
      for (const r of byEmail.values()) if (r.unsubscribeToken === token) { r.unsubscribed = true; return true }
      return false
    },
  }
}
function memRateStore() {
  const m = new Map()
  return { get: k => m.get(k), set: (k, v) => m.set(k, v) }
}

test('isValidEmail / normalizeEmail', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
  assert.ok(isValidEmail('a@b.co'))
  assert.ok(isValidEmail(' User.Name+tag@Domain.io '))
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'x@y.', '@b.com', 'a@.com', 'a@b@c.com']) {
    assert.equal(isValidEmail(bad), false, `should reject: ${JSON.stringify(bad)}`)
  }
})

test('captureEmail — happy path stores normalized email + verdict data', async () => {
  const store = makeFakeStore()
  const r = await captureEmail(store, { email: 'Kartik@Example.com', verdictFY: 2025, verdictAmount: 42000 })
  assert.deepEqual(r, { ok: true })
  const row = store.byEmail.get('kartik@example.com')
  assert.ok(row)
  assert.equal(row.verdictFY, 2025)
  assert.equal(row.verdictAmount, 42000)
  assert.equal(row.source, 'try-verdict')
  assert.ok(row.unsubscribeToken.length >= 16)
})

test('captureEmail — invalid email → 400-class error, nothing stored', async () => {
  const store = makeFakeStore()
  const r = await captureEmail(store, { email: 'not-an-email', verdictFY: 2025, verdictAmount: 1 })
  assert.deepEqual(r, { ok: false, error: 'invalid_email' })
  assert.equal(store.byEmail.size, 0)
})

test('captureEmail — non-integer verdictFY is rejected', async () => {
  const store = makeFakeStore()
  const r = await captureEmail(store, { email: 'a@b.co', verdictFY: NaN, verdictAmount: null })
  assert.deepEqual(r, { ok: false, error: 'invalid_verdict' })
})

test('captureEmail — verdictAmount nullable when uncomputable', async () => {
  const store = makeFakeStore()
  await captureEmail(store, { email: 'a@b.co', verdictFY: 2026, verdictAmount: null })
  assert.equal(store.byEmail.get('a@b.co').verdictAmount, null)
})

test('captureEmail — duplicate is idempotent (one row, token preserved)', async () => {
  const store = makeFakeStore()
  await captureEmail(store, { email: 'dup@x.com', verdictFY: 2025, verdictAmount: 100 })
  const tok1 = store.byEmail.get('dup@x.com').unsubscribeToken
  const r2 = await captureEmail(store, { email: 'dup@x.com', verdictFY: 2026, verdictAmount: 200 })
  assert.deepEqual(r2, { ok: true })
  assert.equal(store.byEmail.size, 1)
  assert.equal(store.byEmail.get('dup@x.com').unsubscribeToken, tok1, 'token must not rotate on re-capture')
  assert.equal(store.byEmail.get('dup@x.com').verdictAmount, 200, 'verdict data updates')
})

test('unsubscribe round-trip: capture → mark by token → unsubscribed', async () => {
  const store = makeFakeStore()
  await captureEmail(store, { email: 'bye@x.com', verdictFY: 2025, verdictAmount: 1 })
  const token = store.byEmail.get('bye@x.com').unsubscribeToken
  assert.equal(store.byEmail.get('bye@x.com').unsubscribed, false)
  assert.equal(await unsubscribeByToken(store, token), true)
  assert.equal(store.byEmail.get('bye@x.com').unsubscribed, true)
  // obviously-bad tokens are rejected without a lookup
  assert.equal(await unsubscribeByToken(store, 'short'), false)
  assert.equal(await unsubscribeByToken(store, 'x'.repeat(30)), false)
})

test('rate limit: allows up to max per window, blocks the rest, resets after window', () => {
  const store = memRateStore()
  const win = 60000, max = 3
  assert.equal(checkRateLimit(store, '1.2.3.4', 0, win, max), true)
  assert.equal(checkRateLimit(store, '1.2.3.4', 10, win, max), true)
  assert.equal(checkRateLimit(store, '1.2.3.4', 20, win, max), true)
  assert.equal(checkRateLimit(store, '1.2.3.4', 30, win, max), false, '4th within window blocked')
  assert.equal(checkRateLimit(store, '9.9.9.9', 30, win, max), true, 'a different IP is independent')
  assert.equal(checkRateLimit(store, '1.2.3.4', 60001, win, max), true, 'window elapsed → allowed again')
})

test('submitCapture NEVER throws — a capture failure cannot break the verdict', async () => {
  const throwing = async () => { throw new Error('network down') }
  const r1 = await submitCapture(throwing, { email: 'a@b.co', verdictFY: 2025, verdictAmount: 1 })
  assert.deepEqual(r1, { ok: false, status: 0 })
  const ok = async () => ({ ok: true, status: 200 })
  const r2 = await submitCapture(ok, { email: 'a@b.co', verdictFY: 2025, verdictAmount: 1 })
  assert.deepEqual(r2, { ok: true, status: 200 })
})
