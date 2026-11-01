import { collectAppData, makeBackupEnvelope } from './backupSync'

/** Save the browser's app data as a JSON file. Returns how many items it held; 0 saves nothing. */
export function downloadBackupFile(): number {
  const data = collectAppData()
  const keys = Object.keys(data).length
  if (keys === 0) return 0
  const blob = new Blob([JSON.stringify(makeBackupEnvelope(data), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `arthvo-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return keys
}
