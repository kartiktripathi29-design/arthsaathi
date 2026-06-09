import { tokens as T } from '@/lib/tokens'

// The one and only ArthVo logo lockup. Swap the mark/wordmark here and every
// surface updates. Transparent — no baked background — so it sits on any color.
//   onTeal  → ivory mark + wordmark, for the teal sidebar cap
//   onLight → teal mark + wordmark, for sand top bars and light surfaces
type LogoVariant = 'onTeal' | 'onLight'

export default function Logo({ variant = 'onLight', size = 32 }: { variant?: LogoVariant; size?: number }) {
  const color = variant === 'onTeal' ? T.ivory : T.teal
  return (
    <span
      role="img"
      aria-label="ArthVo"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(6, Math.round(size * 0.25)), fontFamily: '"Sora",-apple-system,sans-serif' }}
    >
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="104" height="104" rx="28" fill="none" stroke={color} strokeWidth="8" />
        <polygon points="28,28 36,28 60,85 84,28 92,28 60,92" fill={color} />
      </svg>
      <span style={{ fontWeight: 800, fontSize: Math.round(size * 0.6), letterSpacing: '-0.025em', color, lineHeight: 1 }}>ArthVo</span>
    </span>
  )
}
