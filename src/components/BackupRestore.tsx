'use client'
// Data-portability for ArthVo's browser-only storage (BUG-8 mitigation).
//
// All of a user's salary/exemptions/deductions/tax inputs live in localStorage under two app
// namespaces (`av_*` = the wizard, `as_*` = AppStore). That means clearing the browser or moving
// to another device loses everything. This lets the user download a single JSON backup and restore
// it elsewhere — no server, no auth dependency, works regardless of login state.

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { confirmDialog } from '@/components/Dialog'

const C = { fg: '#3A4B41', border: '#E4DDD1', muted: '#7A8A7E' }

const isAppKey = (k: string) => k.startsWith('av_') || k.startsWith('as_')

function collectBackup(): { keys: number; json: string } {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isAppKey(k)) {
      const v = localStorage.getItem(k)
      if (v != null) data[k] = v
    }
  }
  return {
    keys: Object.keys(data).length,
    json: JSON.stringify({ _arthvo_backup: 1, version: 1, exportedAt: new Date().toISOString(), data }, null, 2),
  }
}

export default function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

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
    toast.success(`Backed up ${keys} item${keys > 1 ? 's' : ''}.`)
  }

  const onPick = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      let parsed: any
      try { parsed = JSON.parse(text) } catch { toast.error('That file isn’t valid JSON.'); return }
      const data = parsed?.data
      if (!parsed?._arthvo_backup || !data || typeof data !== 'object') {
        toast.error('That doesn’t look like an ArthVo backup file.')
        return
      }
      const entries = (Object.entries(data) as [string, unknown][])
        .filter(([k, v]) => isAppKey(k) && typeof v === 'string') as [string, string][]
      if (entries.length === 0) { toast.error('The backup is empty.'); return }
      const ok = await confirmDialog({
        title: 'Restore from backup?',
        message: `This replaces your current data with ${entries.length} item${entries.length > 1 ? 's' : ''} from the file. This can’t be undone — download a backup of your current data first if unsure.`,
        confirmLabel: 'Restore', danger: true,
      })
      if (!ok) return
      for (const [k, v] of entries) localStorage.setItem(k, v)
      toast.success('Restored. Reloading…')
      setTimeout(() => window.location.reload(), 700)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px' }}>Back up your data</p>
      <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
        Your salary, exemptions, deductions and tax inputs are saved in this browser only. Download a backup to keep
        them safe or move them to another device — clearing your browser or switching devices otherwise loses them.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={download} disabled={busy} style={{ padding: '9px 14px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⬇ Download backup
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ padding: '9px 14px', background: 'transparent', color: C.fg, border: `1px solid ${C.fg}`, borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⬆ Restore from file
        </button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }}
        />
      </div>
    </div>
  )
}
