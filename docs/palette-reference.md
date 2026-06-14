# ArthVo Palette Reference

Light/dark token values recorded side by side, with computed WCAG contrast for
the text-on-ground pairings actually used in the app.

- **Light** source: `src/lib/tokens.ts` literal-hex block + `src/app/globals.css` `:root`.
- **Dark** source: `src/app/globals.css` `[data-theme="dark"]`.
- Tokens consume CSS vars; components never use raw hex.

> **Dark palette status: D1 first draft — tuning round pending.**
> Per the source comment in `globals.css` (line 50): *"ArthVo dark palette — D1
> first draft (tuning round pending)."* Every dark hex below is provisional and
> may change in the tuning round. Do not treat the dark column as final.

---

## 1. Token table — light vs dark

`var(--*)` is the CSS variable each `T.*` token resolves to.

| Token (`T.*`) | CSS var | Light hex | Dark hex | Role |
|---|---|---|---|---|
| `paper` | `--paper` | `#F8F2E7` | `#141E1B` | page background |
| `sand` | `--sand` | `#ECE3CE` | `#243029` | header band |
| `taupe` | `--taupe` | `#CDB78E` | `#28251E` | desktop sidebar rail |
| `taupeLine` | `--taupe-line` | `#B9A47A` | `#3D372B` | sidebar rail right border |
| `card` | `--card` | `#FFFDF8` | `#1C2723` | panels |
| `cap` | `--cap` | `#0E4D47` | `#0E4D47` *(inherits)* | teal sidebar brand cap |
| `ink` | `--ink` | `#1E2B28` | `#ECE6D9` | primary text |
| `muted` | `--muted` | `#5E6B62` | `#A9B3AB` | statutory sub-labels — body-safe ≥4.5:1 |
| `nav` | `--nav` | `#55615B` | `#9AA59D` | sidebar nav label on taupe |
| `faint` | `--faint` | `#79827B` | `#6F7B73` | meta text — meta ≥13px only, never body text |
| `ctaLabel` | `--cta-label` | `#111111` | `#111111` *(inherits)* | black CTA label |
| `ivory` | `--ivory` | `#F4EEE0` | `#F4EEE0` *(inherits)* | text/marks on teal |
| `onTeal` | `--on-teal` | `#F4EEE0` | `#10201B` | label on teal fills — flips to dark ink when teal lightens in dark mode |
| `teal` | `--teal` | `#0E4D47` | `#3FA98D` | brand accent — CTA / border / header rule / active-nav / winner outline |
| `green` | `--green` | `#157A5B` | `#4FBE93` | real positives only — refund / recommended / progress / Example / slip pill text |
| `hairline` | `--hairline` | `#E7DEC9` | `#2F3C36` | dividers |
| `tint` | `--tint` | `#E3EDEA` | `#1E332D` | soft badge / active-nav background |
| `marigold` | `--marigold` | `#8F6510` | `#D9A23C` | attention accent — empty/pending values, reveal flash ONLY; never decoration |
| `slip.text` | `--slip-t` | `#157A5B` | `#7BD0B0` | "found-on-slip" pill — text |
| `slip.fill` | `--slip-f` | `#E7F3EC` | `#1A2B26` | "found-on-slip" pill — fill |
| `slip.border` | `--slip-b` | `#BFE0CC` | `#2C4A40` | "found-on-slip" pill — border |
| `caution.text` | `--caut-t` | `#9A6B16` | `#D9B25C` | in-app amber caution — text |
| `caution.fill` | `--caut-f` | `#FBF1DD` | `#2A2415` | in-app amber caution — fill |
| `caution.border` | `--caut-b` | `#ECD9AE` | `#4A3D1E` | in-app amber caution — border |

**Inherit note** (from `globals.css` line 52): `ivory`, `ctaLabel` (`--cta-label`),
and `cap` intentionally have **no** dark override — same value in both modes.

> The legacy `--brand / --accent / --success / --danger / --text-* / --border /
> --surface` block in `:root` (globals.css 35–47) is a separate older set, not part
> of the `T.*` token API, and has no dark override. Excluded from this reference.

---

## 2. Contrast — text-on-ground pairings actually used

Ratios computed from the hexes above using the WCAG 2.x relative-luminance
formula (sRGB → linear, `(L_hi+0.05)/(L_lo+0.05)`). Thresholds: **4.5:1** body,
**3:1** large (≥18.66px regular / ≥14px bold).

| Pairing | Light | Dark | Flag |
|---|---:|---:|---|
| ink · paper | 13.17 | 13.72 | — |
| ink · card | 14.43 | 12.38 | — |
| muted · paper | 5.02 | 7.90 | — |
| muted · card | 5.50 | 7.13 | — |
| teal · paper | 8.68 | 5.91 | — |
| teal · card | 9.51 | 5.33 | — |
| teal · tint *(active-nav)* | 8.09 | 4.64 | — |
| green · paper | 4.75 | 7.41 | — |
| green · card | 5.21 | 6.69 | — |
| marigold · paper | 4.67 | 7.46 | — |
| marigold · card | 5.12 | 6.73 | — |
| onTeal · teal | 8.36 | 5.84 | — |
| slip.text · slip.fill | 4.65 | 8.11 | — |
| **nav · taupe** | **3.31** | 6.00 | ⚠ light below body 4.5 (passes large 3:1) |
| **faint · paper** | **3.56** | **3.86** | ⚠ both below body 4.5 (pass large 3:1) — **by design: meta ≥13px only** |
| **faint · card** | **3.90** | **3.49** | ⚠ both below body 4.5 (pass large 3:1) — **by design: meta ≥13px only** |
| **caution.text · caution.fill** | **4.17** | 7.69 | ⚠ light below body 4.5 (passes large 3:1) |
| **ivory · teal** | 8.36 | **2.50** | ⚠ dark **FAILS** even large 3:1 — see note |

### Flag notes

- **nav · taupe (light 3.31)** — sidebar nav labels render at large/semibold weight,
  so they clear the 3:1 large bar but would fail as body text. Borderline; worth a
  look in the tuning round.
- **faint · paper / faint · card (3.49–3.90)** — *expected.* The `faint` token's
  own role says "meta text — meta ≥13px only, never body text." It is not meant to
  satisfy 4.5:1; it sits above the 3:1 large floor.
- **caution.text · caution.fill (light 4.17)** — just under body 4.5:1. If caution
  copy is rendered as body-size text, this is a real miss. Passes the large bar.
- **ivory · teal (dark 2.50, FAIL)** — in **dark** mode `teal` lightens to `#3FA98D`,
  so `ivory` (#F4EEE0, unchanged) no longer has enough contrast. This is why the
  design provides `onTeal`, which **flips to dark ink `#10201B`** in dark mode —
  `onTeal · teal` is **5.84** (pass). Labels on teal fills should use `onTeal`, not
  `ivory`; `ivory` on teal is a light-mode-only safe pairing.

> Reminder: the dark column is **D1 first draft — tuning round pending**. Dark-side
> flags above (and the dark figures generally) are provisional pending that round.
