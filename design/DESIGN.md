# Design system notes

Source of truth for values: `src/styles.css` `:root` (Verified). Machine-readable copy: `design/design-tokens.json`.
Screens: `design/<KEY>/<screen>.html`.

## Principles
- Product name is a token (`{PRODUCT_NAME}`, currently Harbor CRM per AIO-73), never hard-coded in copy.
- Bank identity = `VITE_BANK_NAME`, `VITE_BANK_LOGO_URL` and `--bank-primary` (already used by Login). Reuse, do not duplicate Login.
- Bank colour is for fills, bars and icons only, never text on a surface. Text uses `--text` / `--text-muted`. A fill carries `--bank-on` text at 4.5:1 or better.
- Focus ring is `--text`, 2px, offset 2px, so it holds on any bank colour. On the dark sidebar the ring is `--chrome-text-active` (white).
- Sentence case, no all-caps labels.

## Range chips (Dashboard, AIO-93)
Every metric states its time basis. Solid chip = follows the page range ("Last 30 days"). Dashed chip = not affected by the range ("Right now", "Today").

## App shell and bank theme (AIO-140)
- The only bank inputs are `--bank-primary` and `--bank-on` (plus name and optional logo). Everything else is derived on the same element with `color-mix`, so a new bank re-themes the shell with no other change:
  - `--bank-accent: color-mix(in srgb, var(--bank-primary) 40%, #fff)`: bank colour made visible on the dark sidebar (selected-item bar and icon, the 3 px "tide line" across the top of the app).
  - `--chrome-active: color-mix(in srgb, var(--bank-primary) 38%, var(--chrome-bg))`: fill of the selected sidebar item.
- Sidebar 248 px, icon rail 72 px, phone overlay 288 px under 780 px (the code's breakpoint). Header 60 px (64 phone). Page max width 1200, padding 32 (16 phone). Touch targets 44 px on phone.
- Page title 24/32 700, KPI value 32/36 800, section 18/24 600, controls 14, captions 13, sidebar group labels 12.
- Profile cannot load: Harbor default name and navy, banner with Retry. No logo: name only. No colour: `#1d3a6e`.
- Contrast rule for a bank: `--bank-on` on `--bank-primary` at least 4.5:1 (Assumption: WCAG AA; contrast target still Unknown in AIO-133).

## Screens
- AIO-101: `login.html` (split screen, bank-colour brand side, quiet form side), `login-states.html` (field errors, sign-in failed, loading, focus, reset).
- AIO-93: `dashboard.html` (loaded view, bank themes), `dashboard-states.html` (loading, error with Retry, empty).
- AIO-140: `shell-default.html` (admin, Harbor default), `shell-navigation.html` (rail, phone overlay, group collapsed, focus), `shell-bank-theme.html` (sample bank, light and dark), `shell-states.html` (loading, profile error, no logo or colour, viewer Forbidden), `shell-menus.html` (avatar menu per role, notifications, command bar).
