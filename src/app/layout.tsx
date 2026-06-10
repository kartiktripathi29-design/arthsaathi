import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from '@/store/AppStore'
import { DialogHost } from '@/components/Dialog'
import SyncProvider from '@/components/SyncProvider'
import { tokens as T } from '@/lib/tokens'

export const metadata: Metadata = {
  title: 'ArthVo — Wealth Evolved',
  description: 'Parse your salary slip and compare the old vs new tax regime in minutes.',
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
