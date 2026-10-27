# Design system notes

Source of truth for values: `src/styles.css` `:root` (Verified). Machine-readable copy: `design/design-tokens.json`.
Screens: `design/<KEY>/<screen>.html`.

## Principles
- Product name is a token (`{PRODUCT_NAME}`, currently Harbor CRM per AIO-73), never hard-coded in copy.
- Bank identity = `VITE_BANK_NAME`, `VITE_BANK_LOGO_URL` and `--bank-primary` (already used by Login). Reuse, do not duplicate Login.
- Bank colour is for fills, bars and icons only, never text on a surface. Text uses `--text` / `--text-muted`. A fill carries `--bank-on` text at 4.5:1 or better.
- Focus ring is `--text`, 2px, offset 2px, so it holds on any bank colour.
- Sentence case, no all-caps labels.

## Range chips (Dashboard, AIO-93)
Every metric states its time basis. Solid chip = follows the page range ("Last 30 days"). Dashed chip = not affected by the range ("Right now", "Today").

## Screens
- AIO-101: `login.html` (split screen, bank-colour brand side, quiet form side), `login-states.html` (field errors, sign-in failed, loading, focus, reset).
- AIO-93: `dashboard.html` (loaded view, bank themes), `dashboard-states.html` (loading, error with Retry, empty).
