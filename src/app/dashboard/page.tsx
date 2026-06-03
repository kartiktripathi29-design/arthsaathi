import { redirect } from 'next/navigation'

// /dashboard has no content of its own — the real document-upload flow lives at
// /dashboard/profile/documents. This page previously held a second upload UI, but the
// dashboard layout's AuthGate redirected away from /dashboard within 150ms in every auth
// state, so that UI was unreachable (and its parse flow never completed). Redirect here
// instead. Unauthenticated users land on /documents and AuthGate sends them to /login.
export default function DashboardPage() {
  redirect('/dashboard/profile/documents')
}
