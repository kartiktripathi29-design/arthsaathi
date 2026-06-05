import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const { encryptString, decryptString, isEncrypted, isCryptoConfigured } = await import('./crypto.ts')

const KEY = crypto.randomBytes(32)

test('round-trips arbitrary UTF-8 (incl. emoji + JSON)', () => {
  const plain = JSON.stringify({ av_x: '₹1,23,456', name: 'Vicku 🙂', nested: [1, 2, 3] })
  const token = encryptString(plain, KEY)
  assert.ok(isEncrypted(token))
  assert.equal(decryptString(token, KEY), plain)
})

test('each encryption uses a fresh IV (ciphertexts differ)', () => {
  const a = encryptString('same', KEY)
  const b = encryptString('same', KEY)
  assert.notEqual(a, b)
  assert.equal(decryptString(a, KEY), 'same')
  assert.equal(decryptString(b, KEY), 'same')
})

test('a tampered tag/ciphertext fails to decrypt', () => {
  const token = encryptString('secret', KEY)
  const flipped = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1)
  assert.throws(() => decryptString(flipped, KEY))
})

test('wrong key fails to decrypt', () => {
  const token = encryptString('secret', KEY)
  assert.throws(() => decryptString(token, crypto.randomBytes(32)))
})

test('rejects non-ciphertext input', () => {
  assert.equal(isEncrypted('plain text'), false)
  assert.throws(() => decryptString('plain text', KEY))
})

test('accepts hex and base64 keys, rejects wrong-length', () => {
  const hex = crypto.randomBytes(32).toString('hex')
  const b64 = crypto.randomBytes(32).toString('base64')
  for (const k of [hex, b64]) {
    process.env.ARTHVO_DATA_ENC_KEY = k
    assert.ok(isCryptoConfigured())
    assert.equal(decryptString(encryptString('hi')), 'hi')
  }
  process.env.ARTHVO_DATA_ENC_KEY = 'too-short'
  assert.equal(isCryptoConfigured(), false)
  delete process.env.ARTHVO_DATA_ENC_KEY
  assert.equal(isCryptoConfigured(), false)
})
