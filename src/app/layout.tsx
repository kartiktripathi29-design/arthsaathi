import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from '@/store/AppStore'
import { DialogHost } from '@/components/Dialog'
import SyncProvider from '@/components/SyncProvider'
import { tokens as T } from '@/lib/tokens'

export const metadata: Metadata = {
  title: 'ArthVo — Your salary slip, in plain English',
  description: 'One salary slip shows your real tax — old vs new regime, side by side, in minutes. No jargon, no guesswork.',
}

// viewport-fit=cover lets the app paint edge-to-edge so the sticky header and fixed tab bar can bleed
// to the true screen edges; inner content uses env(safe-area-inset-*) to stay clear of the status bar
// and home indicator. (Set here in the root server layout — the dashboard layout is a client component
// and can't export viewport.)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: T.ink, color: '#fff', borderRadius: '10px', fontSize: '14px', padding: '12px 16px' },
              success: { style: { background: T.green } },
              error: { style: { background: '#DC2626' } },
            }}
          />
          <DialogHost />
          <SyncProvider />
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
