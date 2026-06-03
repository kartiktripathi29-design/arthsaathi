'use client'
// In-app replacements for window.confirm / window.prompt.
//
// Native browser dialogs look untrustworthy on mobile (especially a password prompt) and can't be
// styled. These are promise-based so call sites barely change:
//
//   if (!(await confirmDialog('Delete this slip?'))) return
//   const pwd = await passwordDialog({ title: 'Protected file', message: 'Enter the password' })
//
// A single <DialogHost/> is mounted in the root layout; the exported functions talk to it through a
// module-level bridge (the same pattern react-hot-toast uses). No business logic lives here.

import { useEffect, useState } from 'react'

const C = {
  fg: '#3A4B41', bg: '#FDFAF6', card: '#fff', border: '#E4DDD1',
  text: '#1C2B22', muted: '#7A8A7E', danger: '#B94040', wl: '#F5ECD8',
}

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface PasswordOptions {
  title?: string
  message?: string
  confirmLabel?: string
  placeholder?: string
}

type DialogRequest =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'password'; opts: PasswordOptions; resolve: (v: string | null) => void }

// Bridge between the imperative API and the mounted host.
let emit: ((req: DialogRequest) => void) | null = null

/** Ask the user to confirm an action. Resolves true if they confirm, false otherwise. */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
  return new Promise((resolve) => {
    // Fallback to the native dialog if the host isn't mounted yet (SSR / very early calls).
    if (!emit) { resolve(typeof window !== 'undefined' ? window.confirm(o.message) : false); return }
    emit({ kind: 'confirm', opts: o, resolve })
  })
}

/** Ask the user for a password/secret. Resolves the entered string, or null if cancelled. */
export function passwordDialog(opts: PasswordOptions | string = {}): Promise<string | null> {
  const o: PasswordOptions = typeof opts === 'string' ? { message: opts } : opts
  return new Promise((resolve) => {
    if (!emit) { resolve(typeof window !== 'undefined' ? window.prompt(o.message || '') : null); return }
    emit({ kind: 'password', opts: o, resolve })
  })
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.45)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999,
}
const card: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22,
  width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(28,43,34,0.25)', fontFamily: 'inherit',
}
const btnBase: React.CSSProperties = {
  flex: 1, padding: '11px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', border: 'none',
}

export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null)
  const [pwd, setPwd] = useState('')

  useEffect(() => {
    emit = (r) => { setPwd(''); setReq(r) }
    return () => { emit = null }
  }, [])

  if (!req) return null

  const finish = (value: boolean | string | null) => {
    ;(req.resolve as (v: boolean | string | null) => void)(value)
    setReq(null)
    setPwd('')
  }

  const cancel = () => finish(req.kind === 'confirm' ? false : null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cancel()
  }

  const isConfirm = req.kind === 'confirm'
  const title = req.opts.title || (isConfirm ? 'Please confirm' : 'Enter password')
  const danger = isConfirm && (req.opts as ConfirmOptions).danger

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }} onKeyDown={onKeyDown}>
      <div style={card} role="dialog" aria-modal="true">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>{title}</h2>
        {(req.opts.message) && (
          <p style={{ fontSize: 13, color: C.text, margin: '0 0 16px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{req.opts.message}</p>
        )}

        {req.kind === 'password' && (
          <input
            autoFocus
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') finish(pwd) }}
            placeholder={(req.opts as PasswordOptions).placeholder || 'Password'}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 16,
              border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit',
              outline: 'none', background: C.bg,
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={cancel}
            style={{ ...btnBase, background: C.wl, color: C.fg }}
          >
            {(isConfirm && (req.opts as ConfirmOptions).cancelLabel) || 'Cancel'}
          </button>
          <button
            autoFocus={isConfirm}
            onClick={() => finish(req.kind === 'password' ? pwd : true)}
            style={{ ...btnBase, background: danger ? C.danger : C.fg, color: '#fff' }}
          >
            {req.opts.confirmLabel || (isConfirm ? 'Confirm' : 'Submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
