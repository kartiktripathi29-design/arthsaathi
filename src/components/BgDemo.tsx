'use client'
import { estimateAnnualTax } from '@/lib/tax-slabs'
import { tokens as T } from '@/lib/tokens'

export default function BgDemo({ monthly }: { monthly?: number | null }) {
  const m = monthly && monthly > 0 ? monthly : 120000
  const isExample = !(monthly && monthly > 0)
  const annual = m * 12
  const newTax = estimateAnnualTax(annual, 'new')
  const oldTax = estimateAnnualTax(annual, 'old')

  const slots = [
    'House rent (HRA)',
    'Tax-saving investments',
    'Health insurance',
    'Pension savings (NPS)',
  ]

  const s: Record<string, React.CSSProperties> = {
    wrap: { width: '100%', background: T.card, borderRadius: 16, overflow: 'hidden', fontFamily: '"Sora",-apple-system,sans-serif', position: 'relative' },
    topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${T.hairline}` },
    content: { padding: 16 },
  }

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
            <rect width="120" height="120" rx="14" fill={T.teal}/>
            <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory}/>
            <circle cx="90" cy="24" r="18" fill={T.ivory}/>
            <circle cx="90" cy="24" r="11" fill={T.teal}/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>Arth<span style={{ color: T.teal }}>Vo</span></span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: isExample ? T.muted : T.teal, whiteSpace: 'nowrap' as const }}>
          {isExample ? 'Example — ₹1,20,000/month' : `On your ₹${m.toLocaleString('en-IN')}/month`}
        </span>
      </div>

      <div style={s.content}>
        <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 9, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: T.muted }}>
            Salary alone:{' '}
            <span style={{ color: T.ink, fontWeight: 700 }}>New <span style={{ color: T.teal }}>₹{newTax.toLocaleString('en-IN')}</span></span>
            <span style={{ color: T.faint }}> · </span>
            <span style={{ color: T.muted, fontWeight: 500 }}>Old ₹{oldTax.toLocaleString('en-IN')}</span>
          </div>
          {!isExample && <span style={{ fontSize: 9, color: T.faint, whiteSpace: 'nowrap' as const }}>↑ from your estimate</span>}
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>What your salary slip unlocks</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>These move the numbers — and they&apos;re still blank.</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {slots.map((label, i) => (
            <div key={i} style={{ border: `1px dashed ${T.hairline}`, borderRadius: 9, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
              <span style={{ fontSize: 12, color: T.faint, letterSpacing: '0.04em' }}>₹ —</span>
            </div>
          ))}
        </div>

        <div style={{ background: T.tint, borderRadius: 9, padding: '11px 14px', fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ color: T.teal, fontWeight: 600 }}>Your salary slip fills these in</span>
          <span style={{ color: T.muted }}> — and the regime answer can flip when they do.</span>
        </div>
      </div>
    </div>
  )
}
