import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from '@/store/AppStore'

export const metadata: Metadata = {
  title: 'ArthVo — Wealth Evolved',
  description: 'SEBI RIA-backed AI financial companion. Parse salary slips, optimise taxes, build wealth.',
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
              style: { background: '#1E293B', color: '#fff', borderRadius: '10px', fontSize: '14px', padding: '12px 16px' },
              success: { style: { background: '#059669' } },
              error: { style: { background: '#DC2626' } },
            }}
          />
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
