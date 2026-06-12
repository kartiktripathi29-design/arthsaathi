# App navigation — locked decisions (2026-06-12)

- Mobile: sidebar becomes a 4-tab bottom bar: Documents · Income · Tax breaks · Your Tax.
- "Income" = Salary + Other earnings. "Tax breaks" = Allowances + Deductions.
- Family screens use a top segmented control (Income → "Salary | Other earnings", default Salary; Tax breaks → "Allowances | Deductions", default Allowances). No interstitial menus, no single long stacked page.
- Desktop sidebar mirrors the model: two family section labels with sub-items nested visible (always expanded). Same hierarchy both devices.
- Account chip stays in the top bar (per theming/appearance spec); it is NOT a 5th tab.
- Density inside the Tax breaks screens follows docs/allowances-deductions-redesign.md (common items top-level, long tail grouped).
