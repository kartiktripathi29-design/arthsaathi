import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Minimal localStorage shim so the browser-only helpers can run under node --test.
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

const { isAppKey, collectAppData, applyAppData, makeBackupEnvelope, readBackupEnvelope } =
  await import('./backupSync.ts')

beforeEach(() => globalThis.localStorage.clear())

test('isAppKey only matches the av_/as_ namespaces', () => {
  assert.equal(isAppKey('av_salary'), true)
  assert.equal(isAppKey('as_user'), true)
  assert.equal(isAppKey('theme'), false)
  assert.equal(isAppKey('supabase.auth.token'), false)
})

test('collectAppData picks up only app keys', () => {
  localStorage.setItem('av_salary', '123')
  localStorage.setItem('as_user', 'vicku')
  localStorage.setItem('unrelated', 'x')
  const data = collectAppData()
  assert.deepEqual(data, { av_salary: '123', as_user: 'vicku' })
})

test('applyAppData (merge) writes app keys and leaves others alone', () => {
  localStorage.setItem('av_old', 'keep')
  localStorage.setItem('unrelated', 'keep')
  const n = applyAppData({ av_new: '1', as_x: '2', skipme: '3' })
  assert.equal(n, 2) // skipme ignored
  assert.equal(localStorage.getItem('av_new'), '1')
  assert.equal(localStorage.getItem('av_old'), 'keep') // merge leaves it
  assert.equal(localStorage.getItem('unrelated'), 'keep')
})

test('applyAppData (replace) drops app keys not in the snapshot', () => {
  localStorage.setItem('av_old', 'gone')
  localStorage.setItem('unrelated', 'keep')
  applyAppData({ av_new: '1' }, { replace: true })
  assert.equal(localStorage.getItem('av_old'), null) // removed
  assert.equal(localStorage.getItem('av_new'), '1')
  assert.equal(localStorage.getItem('unrelated'), 'keep') // non-app key untouched
})

test('round-trip: collect → envelope → read returns the same data', () => {
  localStorage.setItem('av_a', '1')
  localStorage.setItem('as_b', '2')
  const env = makeBackupEnvelope(collectAppData())
  assert.equal(env._arthvo_backup, 1)
  const back = readBackupEnvelope(JSON.parse(JSON.stringify(env)))
  assert.deepEqual(back, { av_a: '1', as_b: '2' })
})

test('readBackupEnvelope rejects non-ArthVo payloads and filters junk', () => {
  assert.equal(readBackupEnvelope({ data: { av_a: '1' } }), null) // missing _arthvo_backup
  assert.equal(readBackupEnvelope('nope'), null)
  assert.equal(readBackupEnvelope(null), null)
  // filters out non-app and non-string entries
  const ok = readBackupEnvelope({ _arthvo_backup: 1, data: { av_a: '1', bad: '2', av_n: 5 } })
  assert.deepEqual(ok, { av_a: '1' })
})
