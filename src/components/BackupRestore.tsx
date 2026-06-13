'use client'
// Data safety for ArthVo's browser-only storage (BUG-8).
//
// All of a user's salary/exemptions/deductions/tax inputs live in localStorage (`av_*`/`as_*`).
// When cloud sync is on and the user is signed in, SyncProvider backs this up to their account
// automatically — so this component just reassures them (and offers an optional manual export).
// Otherwise it falls back to manual download/restore so data isn't trapped in one browser.

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { confirmDialog } from '@/components/Dialog'
import { collectAppData, applyAppData, makeBackupEnvelope, readBackupEnvelope } from '@/lib/backupSync'
import { useUser } from '@/lib/useUser'

import { tokens as T } from '@/lib/tokens'

const C = { fg: T.teal, border: T.hairline, muted: T.muted, good: T.green, goodBg: T.slip.fill, goodBorder: T.slip.border }

// Auto-backup is real only when the cloud-sync flag is on AND someone is signed in.
const AUTO_BACKUP = process.env.NEXT_PUBLIC_CLOUD_SYNC === '1'
const SYNCED_AT_KEY = 'arthvo_cloud_synced_at' // written by SyncProvider after each successful sync

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!isFinite(ms) || ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`
  const d = Math.floor(hr / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

function collectBackup(): { keys: number; json: string } {
  const data = collectAppData()
  return { keys: Object.keys(data).length, json: JSON.stringify(makeBackupEnvelope(data), null, 2) }
}

export default function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { user } = useUser()
  const autoOn = AUTO_BACKUP && !!user

  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const read = () => setSyncedAt(localStorage.getItem(SYNCED_AT_KEY))
    read()
    const t = setInterval(read, 5000)
    return () => clearInterval(t)
  }, [])

  const download = () => {
    const { keys, json } = collectBackup()
    if (keys === 0) { toast.error('No saved data to back up yet.'); return }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arthvo-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${keys} item${keys > 1 ? 's' : ''}.`)
  }

  const onPick = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch { toast.error('That file isn’t valid JSON.'); return }
      const data = readBackupEnvelope(parsed)
      if (!data) { toast.error('That doesn’t look like an ArthVo backup file.'); return }
      const count = Object.keys(data).length
      if (count === 0) { toast.error('The backup is empty.'); return }
      const ok = await confirmDialog({
        title: 'Restore from backup?',
        message: `This replaces your current data with ${count} item${count > 1 ? 's' : ''} from the file. This can’t be undone — export a copy of your current data first if unsure.`,
        confirmLabel: 'Restore', danger: true,
      })
      if (!ok) return
      applyAppData(data)
      toast.success('Restored. Reloading…')
      setTimeout(() => window.location.reload(), 700)
    } finally {
      setBusy(false)
    }
  }

  const btnPrimary = { padding: '9px 14px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as const
  const btnGhost = { padding: '9px 14px', background: 'transparent', color: C.fg, border: `1px solid ${C.fg}`, borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as const

  const ManualButtons = ({ primary }: { primary: boolean }) => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button onClick={download} disabled={busy} style={primary ? btnPrimary : btnGhost}>⬇ {autoOn ? 'Export a copy' : 'Download backup'}</button>
      <button onClick={() => fileRef.current?.click()} disabled={busy} style={btnGhost}>⬆ Restore from file</button>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
    </div>
  )

  if (autoOn) {
    return (
      <div style={{ background: C.goodBg, border: `1px solid ${C.goodBorder}`, borderRadius: 8, padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.good, margin: '0 0 4px' }}>🔒 Your data is backed up automatically</p>
        <p style={{ fontSize: 11.5, color: T.green, margin: '0 0 8px', lineHeight: 1.5 }}>
          It’s saved to your account, encrypted, and synced across your devices — clearing this browser or switching
          devices won’t lose anything. Your PAN and Aadhaar are masked and never stored in full.
        </p>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>
          {syncedAt ? `Last backed up ${timeAgo(syncedAt)}.` : 'Syncing…'}
        </p>
        <details>
          <summary style={{ fontSize: 11.5, color: C.muted, cursor: 'pointer' }}>Export or restore a copy manually</summary>
          <div style={{ marginTop: 10 }}><ManualButtons primary={false} /></div>
        </details>
      </div>
    )
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px' }}>Back up your data</p>
      <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
        {AUTO_BACKUP
          ? 'Sign in to back up your data to your account automatically. Until then it’s saved in this browser only — download a copy to keep it safe or move it to another device.'
          : 'Your salary, exemptions, deductions and tax inputs are saved in this browser only. Download a backup to keep them safe or move them to another device — clearing your browser or switching devices otherwise loses them.'}
      </p>
      <ManualButtons primary={true} />
    </div>
  )
}
