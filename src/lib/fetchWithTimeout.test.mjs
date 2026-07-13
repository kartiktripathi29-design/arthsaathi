import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchWithTimeout, RequestTimeoutError } from './fetchWithTimeout.ts'

// Swap global fetch for a controllable fake around each case.
function withFakeFetch(fake, fn) {
  const orig = globalThis.fetch
  globalThis.fetch = fake
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = orig })
}

test('aborts after timeoutMs → RequestTimeoutError (not a generic error)', async () => {
  await withFakeFetch(
    (_url, init) => new Promise((_res, reject) => {
      init.signal.addEventListener('abort', () => {
        const e = new Error('aborted'); e.name = 'AbortError'; reject(e)
      })
    }),
    () => assert.rejects(
      fetchWithTimeout('http://x', {}, { timeoutMs: 20 }),
      (e) => e instanceof RequestTimeoutError && /took too long/i.test(e.message),
    ),
  )
})

test('calls onSlow once after slowAfterMs while the request is still alive', async () => {
  let resolve
  await withFakeFetch(
    () => new Promise((res) => { resolve = res }),
    async () => {
      let slowCalls = 0
      const p = fetchWithTimeout('http://x', {}, { timeoutMs: 500, slowAfterMs: 20, onSlow: () => { slowCalls++ } })
      await new Promise((r) => setTimeout(r, 60))
      assert.equal(slowCalls, 1)
      resolve(new Response('ok', { status: 200 }))
      const res = await p
      assert.equal(res.status, 200)
    },
  )
})

test('a fast success returns the response and never fires onSlow', async () => {
  await withFakeFetch(
    () => Promise.resolve(new Response('ok', { status: 200 })),
    async () => {
      let slowCalls = 0
      const res = await fetchWithTimeout('http://x', {}, { timeoutMs: 1000, slowAfterMs: 50, onSlow: () => { slowCalls++ } })
      assert.equal(res.status, 200)
      await new Promise((r) => setTimeout(r, 80)) // past slowAfterMs — timer must have been cleared
      assert.equal(slowCalls, 0)
    },
  )
})

test('a non-abort fetch rejection propagates unchanged', async () => {
  await withFakeFetch(
    () => Promise.reject(new TypeError('network down')),
    () => assert.rejects(
      fetchWithTimeout('http://x', {}, { timeoutMs: 1000 }),
      (e) => e instanceof TypeError && !(e instanceof RequestTimeoutError),
    ),
  )
})
