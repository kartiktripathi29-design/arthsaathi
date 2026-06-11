# ArthVo Palette — Canonical Token Set

The single source of truth for ArthVo's "paper & teal" visual system. The token
layer (CSS custom properties in `globals.css` and the typed object in
`src/lib/tokens.ts`) is generated from this doc. Component code consumes tokens
only — no raw hex in components.

## CSS variables (canonical)

```css
--paper:#F8F2E7; --sand:#ECE3CE; --taupe:#CDB78E; --taupe-line:#B9A47A;
--card:#FFFDF8; --cap:#0E4D47;
--ink:#1E2B28; --muted:#6E7B72; --nav:#55615B; --faint:#8A938C;
--cta-label:#111111; --ivory:#F4EEE0;
--teal:#0E4D47; --green:#157A5B;
--hairline:#E7DEC9; --tint:#E3EDEA;
--marigold:#B07F1A;
--slip-t:#157A5B; --slip-f:#E7F3EC; --slip-b:#BFE0CC;
--caut-t:#9A6B16; --caut-f:#FBF1DD; --caut-b:#ECD9AE;
```

## Roles

| Token | Hex | Role |
|-------|-----|------|
| `paper` | `#F8F2E7` | page background |
| `sand` | `#ECE3CE` | header band |
| `taupe` | `#CDB78E` | desktop sidebar rail |
| `taupe-line` | `#B9A47A` | sidebar rail right border |
| `card` | `#FFFDF8` | panels |
| `cap` | `#0E4D47` | teal sidebar brand cap |
| `ink` | `#1E2B28` | primary text |
| `muted` | `#6E7B72` | statutory sub-labels |
| `nav` | `#55615B` | sidebar nav label on taupe |
| `faint` | `#8A938C` | meta text |
| `cta-label` | `#111111` | black CTA label |
| `ivory` | `#F4EEE0` | text/marks on teal |
| `teal` | `#0E4D47` | brand accent — CTA / border / header rule / active-nav / winner outline |
| `green` | `#157A5B` | real positives only — refund / recommended / progress / Example / slip pill text |
| `hairline` | `#E7DEC9` | dividers |
| `tint` | `#E3EDEA` | soft badge / active-nav background |
| `marigold` | `#B07F1A` | attention accent — empty/pending values, reveal flash ONLY; never decoration |

### Slip set — "found-on-slip" pill

| Token | Hex | Role |
|-------|-----|------|
| `slip-t` | `#157A5B` | text |
| `slip-f` | `#E7F3EC` | fill |
| `slip-b` | `#BFE0CC` | border |

### Caution set — in-app amber caution

| Token | Hex | Role |
|-------|-----|------|
| `caut-t` | `#9A6B16` | text |
| `caut-f` | `#FBF1DD` | fill |
| `caut-b` | `#ECD9AE` | border |
