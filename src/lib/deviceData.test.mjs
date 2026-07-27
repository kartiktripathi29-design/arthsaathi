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

const { reconcileDeviceOwner, clearTaxData } = await import('./deviceData.ts')

const OWNER = 'arthvo_data_owner'
// Seed a realistic "device already has someone's tax data" state.
function seedTaxData() {
  localStorage.setItem('av_salary_timeline', '[{"grossSalary":219791}]')
  localStorage.setItem('av_salary_summary', '{"annualGross":2637492,"annualTDS":420000}')
  localStorage.setItem('av_tax_computation', '{"refund":57302}')
  localStorage.setItem('as_tax', '{"regime":"new"}')
  localStorage.setItem('av_theme', 'dark')            // UI pref — must survive
  localStorage.setItem('supabase.auth.token', 'sess') // non-app key — must survive
}
const hasTaxData = () =>
  localStorage.getItem('av_salary_timeline') !== null ||
  localStorage.getItem('av_salary_summary') !== null ||
  localStorage.getItem('av_tax_computation') !== null ||
  localStorage.getItem('as_tax') !== null

beforeEach(() => globalThis.localStorage.clear())

test('BEHAVIOR 1 — new signup starts empty (device had a stranger\'s data)', () => {
  seedTaxData()
  reconcileDeviceOwner('ritika.thakur@example.com', { isSignup: true })
  assert.equal(hasTaxData(), false, 'tax data must be wiped on a fresh signup')
  assert.equal(localStorage.getItem(OWNER), 'ritika.thakur@example.com', 'device claimed for new account')
})

test('BEHAVIOR 2 — same-user login KEEPS their data', () => {
  seedTaxData()
  localStorage.setItem(OWNER, 'kartik@example.com') // this device is already theirs
  reconcileDeviceOwner('kartik@example.com', { isSignup: false })
  assert.equal(hasTaxData(), true, 'returning user on their own device keeps their work')
  assert.equal(localStorage.getItem('av_salary_summary'), '{"annualGross":2637492,"annualTDS":420000}')
})

test('BEHAVIOR 3 — different-user login CLEARS the previous owner\'s data', () => {
  seedTaxData()
  localStorage.setItem(OWNER, 'kartik@example.com')
  reconcileDeviceOwner('someone.else@example.com', { isSignup: false })
  assert.equal(hasTaxData(), false, 'a different account must not see the prior owner\'s data')
  assert.equal(localStorage.getItem(OWNER), 'someone.else@example.com')
})

test('ROLLOUT-SAFE — login with no prior owner adopts without wiping', () => {
  seedTaxData() // e.g. an already-logged-in user on first load after this ships
  reconcileDeviceOwner('kartik@example.com', { isSignup: false })
  assert.equal(hasTaxData(), true, 'unowned data is adopted, not nuked')
  assert.equal(localStorage.getItem(OWNER), 'kartik@example.com')
})

test('PRESERVE — UI prefs and non-app keys survive a clear', () => {
  seedTaxData()
  clearTaxData()
  assert.equal(localStorage.getItem('av_theme'), 'dark', 'theme pref preserved')
  assert.equal(localStorage.getItem('supabase.auth.token'), 'sess', 'non-app key untouched')
  assert.equal(localStorage.getItem('av_salary_timeline'), null, 'financial data cleared')
})
