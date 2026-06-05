// Owner-identity verification for uploaded salary slips.
// First slip seeds the identity; later uploads are compared against it.

const STORAGE_KEY = 'av_user_identity'

export interface OwnerIdentity {
  employeeName: string
  pan: string
  aadhaarLast4: string
  seededAt: string
}

export interface ParsedIdentity {
  employeeName?: string | null
  pan?: string | null
  aadhaarLast4?: string | null
}

function normName(s: string | null | undefined): string {
  if (!s) return ''
  // lowercase, collapse whitespace, drop middle initials/dots
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

function normPan(s: string | null | undefined): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normAadhaarLast4(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '').slice(-4)
}

// Names match if first+last tokens align (so "Vicku K Sharma" matches "Vicku Sharma").
function nameMatches(a: string, b: string): boolean {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return true // can't tell — don't flag
  if (na === nb) return true
  const ta = na.split(' ')
  const tb = nb.split(' ')
  if (ta.length < 2 || tb.length < 2) return na === nb
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]
}

export function getStoredIdentity(): OwnerIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OwnerIdentity
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function setStoredIdentity(id: OwnerIdentity): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(id)) } catch {}
}

export function clearStoredIdentity(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// Seed identity from the first slip that has any identifying field.
// Returns true if a new identity was seeded.
export function seedIfMissing(parsed: ParsedIdentity): boolean {
  if (getStoredIdentity()) return false
  const employeeName = (parsed.employeeName || '').trim()
  const pan = normPan(parsed.pan)
  const aadhaarLast4 = normAadhaarLast4(parsed.aadhaarLast4)
  if (!employeeName && !pan && !aadhaarLast4) return false
  setStoredIdentity({
    employeeName,
    pan,
    aadhaarLast4,
    seededAt: new Date().toISOString(),
  })
  return true
}

export interface IdentityCheckResult {
  ok: boolean
  mismatches: string[]
  // When stored identity has missing fields, the slip can fill them in — caller
  // can save this back via setStoredIdentity to enrich the identity.
  enriched?: OwnerIdentity
}

// ─── Masking (BUG-8 privacy model B+: never show PAN/Aadhaar in full) ──────────────
// PAN is 10 chars (ABCDE1234F); show only the last 4. Aadhaar we only ever keep the last 4 of.

export function maskPan(pan: string | null | undefined): string {
  const p = normPan(pan)
  if (!p) return ''
  return p.length <= 4 ? p : '•'.repeat(p.length - 4) + p.slice(-4)
}

export function maskAadhaarLast4(value: string | null | undefined): string {
  const d = normAadhaarLast4(value)
  return d ? `•••• •••• ${d}` : ''
}

export function verifyIdentity(parsed: ParsedIdentity): IdentityCheckResult {
  const stored = getStoredIdentity()
  if (!stored) return { ok: true, mismatches: [] } // no baseline yet

  const mismatches: string[] = []

  // PAN — strongest signal
  const slipPan = normPan(parsed.pan)
  if (stored.pan && slipPan && slipPan !== stored.pan) {
    mismatches.push(`PAN: slip shows ${slipPan}, your records have ${stored.pan}`)
  }

  // Aadhaar last 4
  const slipAadhaar = normAadhaarLast4(parsed.aadhaarLast4)
  if (stored.aadhaarLast4 && slipAadhaar && slipAadhaar !== stored.aadhaarLast4) {
    mismatches.push(`Aadhaar last-4: slip shows ${slipAadhaar}, your records have ${stored.aadhaarLast4}`)
  }

  // Name — fuzzy
  if (stored.employeeName && parsed.employeeName && !nameMatches(stored.employeeName, parsed.employeeName)) {
    mismatches.push(`Name: slip shows "${parsed.employeeName}", your records have "${stored.employeeName}"`)
  }

  // Build an enriched copy if the slip filled in fields we didn't have.
  let enriched: OwnerIdentity | undefined
  if (mismatches.length === 0) {
    const updated: OwnerIdentity = { ...stored }
    let changed = false
    if (!stored.pan && slipPan) { updated.pan = slipPan; changed = true }
    if (!stored.aadhaarLast4 && slipAadhaar) { updated.aadhaarLast4 = slipAadhaar; changed = true }
    if (!stored.employeeName && parsed.employeeName) { updated.employeeName = parsed.employeeName.trim(); changed = true }
    if (changed) enriched = updated
  }

  return { ok: mismatches.length === 0, mismatches, enriched }
}
