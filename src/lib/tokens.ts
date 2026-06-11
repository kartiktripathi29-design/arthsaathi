/**
 * ArthVo palette — canonical token set.
 *
 * Typed mirror of the CSS custom properties in `src/app/globals.css`.
 * Source of truth: docs/arthvo-palette.md. Keep all three in sync.
 *
 * Components consume tokens only — no raw hex in component code.
 */

export const tokens = {
  paper: '#F8F2E7',        // page background
  sand: '#ECE3CE',         // header band
  taupe: '#CDB78E',        // desktop sidebar rail
  taupeLine: '#B9A47A',    // sidebar rail right border
  card: '#FFFDF8',         // panels
  cap: '#0E4D47',          // teal sidebar brand cap
  ink: '#1E2B28',          // primary text
  muted: '#5E6B62',        // statutory sub-labels — body-safe ≥4.5:1
  nav: '#55615B',          // sidebar nav label on taupe
  faint: '#79827B',        // meta text — meta ≥13px only, never body text
  ctaLabel: '#111111',     // black CTA label
  ivory: '#F4EEE0',        // text/marks on teal
  teal: '#0E4D47',         // brand accent — CTA / border / header rule / active-nav / winner outline
  green: '#157A5B',        // real positives only — refund / recommended / progress / Example / slip pill text
  hairline: '#E7DEC9',     // dividers
  tint: '#E3EDEA',         // soft badge / active-nav background
  marigold: '#8F6510',     // attention accent — empty/pending values, reveal flash ONLY; never decoration

  /** "found-on-slip" pill */
  slip: {
    text: '#157A5B',
    fill: '#E7F3EC',
    border: '#BFE0CC',
  },

  /** in-app amber caution */
  caution: {
    text: '#9A6B16',
    fill: '#FBF1DD',
    border: '#ECD9AE',
  },
} as const

export type Tokens = typeof tokens

export default tokens
