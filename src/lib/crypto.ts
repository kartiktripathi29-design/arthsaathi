// Server-side symmetric encryption for BUG-8 cloud persistence (privacy model B+: encrypted at
// rest, recoverable — NOT zero-knowledge). The whole user blob is encrypted here before it touches
// the database; the same primitive field-encrypts PAN/Aadhaar.
//
// ⚠️ SERVER ONLY. This reads a secret from process.env and must never be imported into client code
// (the key would be inlined into the browser bundle). Import only from Route Handlers / server libs.

import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit nonce, the GCM standard
const TAG_LENGTH = 16
const PREFIX = 'gcm1:' // versioned so the format can evolve without ambiguity

const ENV_KEY = 'ARTHVO_DATA_ENC_KEY'

/** Parse a 32-byte key from hex (64 chars) or base64. Throws with an actionable message. */
function parseKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      `${ENV_KEY} is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    )
  }
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error(`${ENV_KEY} must decode to 32 bytes (got ${key.length}). Use 32 random bytes as base64 or hex.`)
  }
  return key
}

function getKey(): Buffer {
  return parseKey(process.env[ENV_KEY])
}

/** True if a string is one of our ciphertexts (cheap check before attempting decryption). */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/**
 * Encrypt a UTF-8 string. Output is `gcm1:` + base64(iv ‖ authTag ‖ ciphertext) — a single
 * self-contained token safe to store in a TEXT column. `key` is injectable for tests.
 */
export function encryptString(plaintext: string, key: Buffer = getKey()): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/**
 * Decrypt a token produced by {@link encryptString}. Throws if the token is malformed or its auth
 * tag fails (tampering / wrong key). `key` is injectable for tests.
 */
export function decryptString(token: string, key: Buffer = getKey()): string {
  if (!isEncrypted(token)) throw new Error('Not an ArthVo ciphertext (missing version prefix).')
  const buf = Buffer.from(token.slice(PREFIX.length), 'base64')
  if (buf.length < IV_LENGTH + TAG_LENGTH) throw new Error('Ciphertext too short / corrupt.')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** True when an encryption key is configured — lets routes degrade gracefully instead of throwing. */
export function isCryptoConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}
