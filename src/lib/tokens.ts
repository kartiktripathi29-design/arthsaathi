/**
 * ArthVo palette — canonical token set.
 *
 * Typed mirror of the CSS custom properties in `src/app/globals.css`.
 * Source of truth: docs/arthvo-palette.md. Keep all three in sync.
 *
 * Components consume tokens only — no raw hex in component code.
 */

// Values are CSS-variable references (defined in src/app/globals.css :root, overridden by the
// [data-theme="dark"] block). Components stay agnostic — they read tokens, the var() resolves per theme.
//
// Light-mode literal hexes (reference only — the live values come from the CSS vars):
//   paper #F8F2E7 · sand #ECE3CE · taupe #CDB78E · taupeLine #B9A47A · card #FFFDF8 · cap #0E4D47
//   ink #1E2B28 · muted #5E6B62 · nav #55615B · faint #79827B · ctaLabel #111111 · ivory #F4EEE0
//   teal #0E4D47 · green #157A5B · hairline #E7DEC9 · tint #E3EDEA · marigold #8F6510
//   slip { text #157A5B · fill #E7F3EC · border #BFE0CC } · caution { text #9A6B16 · fill #FBF1DD · border #ECD9AE }
export const tokens = {
  paper: 'var(--paper)',        // page background
  sand: 'var(--sand)',          // header band
  taupe: 'var(--taupe)',        // desktop sidebar rail
  taupeLine: 'var(--taupe-line)', // sidebar rail right border
  card: 'var(--card)',          // panels
  cap: 'var(--cap)',            // teal sidebar brand cap
  ink: 'var(--ink)',            // primary text
  muted: 'var(--muted)',        // statutory sub-labels — body-safe ≥4.5:1
  nav: 'var(--nav)',            // sidebar nav label on taupe
  faint: 'var(--faint)',        // meta text — meta ≥13px only, never body text
  ctaLabel: 'var(--cta-label)', // black CTA label
  ivory: 'var(--ivory)',        // text/marks on teal
  onTeal: 'var(--on-teal)',     // label on teal fills — flips to dark ink when teal lightens in dark mode
  teal: 'var(--teal)',          // brand accent — CTA / border / header rule / active-nav / winner outline
  green: 'var(--green)',        // real positives only — refund / recommended / progress / Example / slip pill text
  hairline: 'var(--hairline)',  // dividers
  tint: 'var(--tint)',          // soft badge / active-nav background
  marigold: 'var(--marigold)',  // attention accent — empty/pending values, reveal flash ONLY; never decoration

  /** "found-on-slip" pill */
  slip: {
    text: 'var(--slip-t)',
    fill: 'var(--slip-f)',
    border: 'var(--slip-b)',
  },

  /** in-app amber caution */
  caution: {
    text: 'var(--caut-t)',
    fill: 'var(--caut-f)',
    border: 'var(--caut-b)',
  },

  /** danger — error / over-budget / negative amounts */
  danger: {
    text: 'var(--danger-t)',
    fill: 'var(--danger-f)',
    border: 'var(--danger-b)',
  },

  /** source — "inferred from another slip" timeline state */
  source: {
    text: 'var(--src-t)',
    fill: 'var(--src-f)',
    border: 'var(--src-b)',
  },
} as const

export type Tokens = typeof tokens

export default tokens
