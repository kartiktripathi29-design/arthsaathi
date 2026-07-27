import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { isAnthropicOutage, UPSTREAM_BUSY_MESSAGE } from './anthropic-error.ts'

// Real SDK error instances (the primary instanceof path).
test('real Anthropic API errors that ARE outages → true', () => {
  assert.equal(isAnthropicOutage(new APIError(429, undefined, 'rate limited', undefined)), true)   // rate limit
  assert.equal(isAnthropicOutage(new APIError(529, undefined, 'overloaded', undefined)), true)     // overloaded
  assert.equal(isAnthropicOutage(new APIError(500, undefined, 'server', undefined)), true)         // 5xx
  assert.equal(isAnthropicOutage(new APIError(503, undefined, 'unavailable', undefined)), true)
  assert.equal(isAnthropicOutage(new APIConnectionError({ message: 'Connection error' })), true)   // dropped
  assert.equal(isAnthropicOutage(new APIConnectionTimeoutError({ message: 'timed out' })), true)   // timeout
})

test('real Anthropic API errors that are NOT outages (our request) → false', () => {
  assert.equal(isAnthropicOutage(new APIError(400, undefined, 'bad request', undefined)), false)   // bad input
  assert.equal(isAnthropicOutage(new APIError(404, undefined, 'not found', undefined)), false)
  assert.equal(isAnthropicOutage(new APIError(401, undefined, 'auth', undefined)), false)          // misconfig, not outage
})

// The content-failure path MUST stay false — a slip we read but couldn't extract JSON from is the
// user's problem to fix (422), never a "reader overloaded, retry" (503). This is the whole point.
test('content / input errors → false (keep their 422)', () => {
  assert.equal(isAnthropicOutage(new Error('Could not extract JSON from Claude response')), false)
  assert.equal(isAnthropicOutage(new Error('This spreadsheet appears to be empty.')), false)
  assert.equal(isAnthropicOutage(null), false)
  assert.equal(isAnthropicOutage(undefined), false)
  assert.equal(isAnthropicOutage('some string'), false)
})

// Defensive fallback for errors that lost their prototype (rewrapped/serialized upstream).
test('shape-based fallback for prototype-less errors', () => {
  assert.equal(isAnthropicOutage({ status: 429 }), true)
  assert.equal(isAnthropicOutage({ status: 502 }), true)
  assert.equal(isAnthropicOutage({ status: 400 }), false)
  assert.equal(isAnthropicOutage({ name: 'Error', message: 'Overloaded' }), true)
  assert.equal(isAnthropicOutage({ message: 'socket hang up' }), true)
  assert.equal(isAnthropicOutage({ message: 'ECONNRESET' }), true)
  assert.equal(isAnthropicOutage({ message: 'blurry image, please retake' }), false)
})

test('exports a non-empty user-facing message', () => {
  assert.ok(typeof UPSTREAM_BUSY_MESSAGE === 'string' && UPSTREAM_BUSY_MESSAGE.length > 0)
})
