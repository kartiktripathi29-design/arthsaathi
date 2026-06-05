import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// Simulate the full BUG-8 data path with the REAL modules:
//   device A localStorage → collectAppData → JSON → encryptString (server)
//   → [stored blob] → decryptString (server) → JSON → applyAppData → device B localStorage

class MemStorage {
  #m = new Map()
  get length() { return this.#m.size }
  key(i) { return [...this.#m.keys()][i] ?? null }
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null }
  setItem(k, v) { this.#m.set(k, String(v)) }
  removeItem(k) { this.#m.delete(k) }
  clear() { this.#m.clear() }
}
globalThis.window = globalThis
globalThis.localStorage = new MemStorage()
process.env.ARTHVO_DATA_ENC_KEY = crypto.randomBytes(32).toString('base64')

const { collectAppData, applyAppData } = await import('./backupSync.ts')
const { encryptString, decryptString } = await import('./crypto.ts')

// What the PUT route does with the request body.
function serverStore(snapshot) {
  return encryptString(JSON.stringify(snapshot))
}
// What the GET route does with the stored row.
function serverLoad(blob) {
  return JSON.parse(decryptString(blob))
}

beforeEach(() => globalThis.localStorage.clear())

test('device A → cloud → device B reproduces the same app state', () => {
  // Device A has some app data + an unrelated key that must NOT sync.
  localStorage.setItem('av_salary', JSON.stringify({ gross: 1200000 }))
  localStorage.setItem('as_user', 'vicku')
  localStorage.setItem('av_user_identity', JSON.stringify({ pan: 'ABCDE1234F' }))
  localStorage.setItem('theme', 'dark') // not av_/as_ → excluded

  // Push from A.
  const blob = serverStore(collectAppData())
  assert.ok(blob.startsWith('gcm1:')) // actually encrypted at rest
  assert.ok(!blob.includes('ABCDE1234F')) // PAN not in plaintext on the wire/at rest

  // Fresh device B, with leftover stale app data that a newer remote should replace.
  localStorage.clear()
  localStorage.setItem('av_stale', 'should be dropped')
  localStorage.setItem('theme', 'light') // device-local, must survive

  // Pull on B.
  const snapshot = serverLoad(blob)
  applyAppData(snapshot, { replace: true })

  assert.equal(localStorage.getItem('av_salary'), JSON.stringify({ gross: 1200000 }))
  assert.equal(localStorage.getItem('as_user'), 'vicku')
  assert.equal(localStorage.getItem('av_user_identity'), JSON.stringify({ pan: 'ABCDE1234F' }))
  assert.equal(localStorage.getItem('av_stale'), null)   // replaced
  assert.equal(localStorage.getItem('theme'), 'light')    // non-app key untouched
})

test('blob is opaque at rest and tamper-evident', () => {
  localStorage.setItem('av_x', 'secret-value')
  const blob = serverStore(collectAppData())
  assert.ok(!blob.includes('secret-value'))
  const tampered = blob.slice(0, -3) + (blob.endsWith('A') ? 'BBB' : 'AAA')
  assert.throws(() => serverLoad(tampered))
})
