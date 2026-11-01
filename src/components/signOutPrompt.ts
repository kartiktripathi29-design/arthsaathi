import { choiceDialog, confirmDialog } from '@/components/Dialog'
import { downloadBackupFile } from '@/lib/backupDownload'

// Signing out erases what's only in this browser, so offer a backup first. Resolves true to sign out.
export async function confirmSignOut(): Promise<boolean> {
  const choice = await choiceDialog({
    title: 'Sign out?',
    message: 'Signing out will clear your rent and deductions from this browser. Download a backup first?',
    options: [
      { value: 'download', label: 'Download backup', primary: true },
      { value: 'signout', label: 'Sign out anyway' },
    ],
    fallback: 'signout',
  })
  if (choice === null) return false
  if (choice === 'signout') return true
  downloadBackupFile()
  // Stay signed in until they've seen the file arrive, in case the browser blocked it.
  return confirmDialog({
    title: 'Backup downloaded',
    message: 'Check that the file saved, then sign out. It isn’t encrypted and can include your full PAN, so store it somewhere safe.',
    confirmLabel: 'Sign out',
  })
}
