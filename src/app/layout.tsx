import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { PasswordGate } from '@/components/PasswordGate'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  title: 'ArthVo — Wealth Evolved',
  description: 'SEBI RIA-backed AI financial companion. Parse salary slips, optimise taxes, build wealth.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PasswordGate>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1A3C5E', color: '#fff', borderRadius: '10px', fontSize: '14px', padding: '12px 16px' },
            success: { style: { background: '#1E8449' } },
            error: { style: { background: '#C0392B' } },
          }}
        />
        </PasswordGate>
        <Analytics />
      </body>
    </html>
  )
}
