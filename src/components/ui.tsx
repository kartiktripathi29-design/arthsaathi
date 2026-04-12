'use client'
import React from 'react'

// ─── Stat Card ────────────────────────────────────────────────────────────
export function StatCard({
  label, value, sub, color = '#1A3C5E', icon, trend
}: {
  label: string; value: string; sub?: string
  color?: string; icon?: string; trend?: { dir: 'up' | 'down'; label: string }
}) {
  return (
    <div className="stat-card" style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#5D6D7E', fontWeight: 500 }}>{label}</div>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1, marginBottom: sub ? 6 : 0 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sub && <div style={{ fontSize: 12, color: '#95A5A6' }}>{sub}</div>}
        {trend && (
          <div style={{ fontSize: 11, fontWeight: 600, color: trend.dir === 'up' ? '#1E8449' : '#C0392B' }}>
            {trend.dir === 'up' ? '↑' : '↓'} {trend.label}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────
export function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2833' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#5D6D7E', marginTop: 3 }}>{sub}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'orange' | 'red' | 'gray' }) {
  const styles: Record<string, { bg: string; text: string }> = {
    blue:   { bg: '#E8F1FA', text: '#1A3C5E' },
    green:  { bg: '#E9F7EF', text: '#1E8449' },
    orange: { bg: '#FEF3E2', text: '#92400E' },
    red:    { bg: '#FDEDEC', text: '#C0392B' },
    gray:   { bg: '#F1F2F4', text: '#5D6D7E' },
  }
  const s = styles[color]
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.text }}>{children}</span>
  )
}

// ─── Info Box ─────────────────────────────────────────────────────────────
export function InfoBox({ icon = 'ℹ️', children, variant = 'info' }: { icon?: string; children: React.ReactNode; variant?: 'info' | 'success' | 'warning' | 'danger' }) {
  const styles = {
    info:    { bg: '#E8F1FA', border: '#A8CCE8', text: '#1A3C5E' },
    success: { bg: '#E9F7EF', border: '#A9DFBF', text: '#1E5631' },
    warning: { bg: '#FEF3E2', border: '#F0C070', text: '#78350F' },
    danger:  { bg: '#FDEDEC', border: '#F5C6C2', text: '#922B21' },
  }
  const s = styles[variant]
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 18px', fontSize: 13, color: s.text, lineHeight: 1.7 }}>
      {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
      {children}
    </div>
  )
}

// ─── Pill Tabs ────────────────────────────────────────────────────────────
export function PillTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F1F2F4', borderRadius: 10, padding: 3, width: 'fit-content' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          style={{ padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: active === t ? 600 : 400, cursor: 'pointer', background: active === t ? '#fff' : 'transparent', color: active === t ? '#1C2833' : '#5D6D7E', boxShadow: active === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ─── Progress Row ─────────────────────────────────────────────────────────
export function ProgressRow({ label, value, max, color, format }: { label: string; value: number; max: number; color: string; format?: (n: number) => string }) {
  const pct = Math.min(100, (value / max) * 100)
  const fmt = format || ((n: number) => `₹${n.toLocaleString('en-IN')}`)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: '#5D6D7E' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>{fmt(value)} <span style={{ fontWeight: 400, color: '#95A5A6', fontSize: 11 }}>/ {fmt(max)}</span></span>
      </div>
      <div style={{ height: 7, background: '#F1F2F4', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────
export function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 14, padding: '22px 24px', ...style }}>
      {children}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────
export function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: action ? 20 : 0, lineHeight: 1.6, maxWidth: 360, margin: '0 auto', ...(action ? { marginBottom: 20 } : {}) }}>{desc}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// ─── Tooltip Wrapper ──────────────────────────────────────────────────────
export function Tip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="tooltip" data-tip={tip} style={{ cursor: 'help', borderBottom: '1px dashed #95A5A6' }}>
      {children}
    </span>
  )
}
