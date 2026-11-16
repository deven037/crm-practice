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

## Harbor CRM 3.0 (branch `v3`)

3.0 serves many banks from one site. The sections above describe the 2.x screens that are still waiting for their 3.0 redesign; where they disagree with this section, this section wins.

### One bank colour drives the theme
- The bank's colour comes from its profile in the database (registration, later Bank profile in Setup), not from `VITE_BANK_*` variables.
- `src/theme/bankTheme.ts` turns that one colour into four values and sets them on `:root`: `--bank-primary` (fills), `--bank-on` (text on a fill), `--bank-ink-light` and `--bank-ink-dark` (the colour moved toward black or white until it reads at 4.5:1 as text or a focus ring on the light and the dark surface).
- `src/styles/v3.css` derives everything else with `color-mix`: neutrals carry 4 to 10% of the bank colour, `--bank-soft` and `--bank-soft-line` for tinted fills, the deep sidebar (`--chrome-*`), overlays and `--shadow-bank`.
- One accent only. `--accent`, `--accent-create` and `--accent-apply` all resolve to the bank; the older blue, pink and lime accents are gone.
- `--bank-ink` may be used for text and links. Raw `--bank-primary` is still for fills, bars and icons only.
- Focus ring: `--focus-ring` (2 px surface gap, 2 px `--bank-ink`).
- Light and dark: `:root[data-theme='dark']` re-values the same tokens. The sidebar stays deep in both.
- No colour on the profile: Harbor navy `#1d3a6e`.

### Type, shape, depth
- Display face Bricolage Grotesque (`--font-display`: page titles, big numbers, front-door headings); text face IBM Plex Sans (`--font-sans`). Both self-hosted through `@fontsource-variable`.
- Radii 8, 12, 16, 22 (`--radius-sm` to `--radius-xl`).
- Depth comes from layered shadows (`--shadow-sm` to `--shadow-lg`) and translucent glass (`--glass`, `--glass-strong`, `--glass-blur`) on the top bar, menus, side panels and the platform console card.

### Motion
- Built with the Motion library (`motion/react`) plus CSS transitions. Durations 150, 220 and 350 ms (`--duration-fast`, `--duration-base`, `--duration-slow`); easings `--ease-standard`, `--ease-out`, `--ease-spring`.
- Shared pieces in `src/components/v3.tsx`: `AnimatedNumber` (figures count up), `SavedTick`, `EmptyState`, `PageSkeleton` (shimmering placeholders, not spinners), `originFromLastClick` (dialogs and menus grow from where the person clicked), `closeWithExit`.
- Motion never blocks a click and switches off under `prefers-reduced-motion` (CSS rule at the end of `v3.css`, `MotionConfig reducedMotion="user"` around animated pages).

### Front door (`src/pages/frontdoor/`, `front-door.css`, `front-door-pages.css`)
- `FrontDoorShell`: form on the left, picture on the right; one column under 900 px. With no bank it shows the Harbor platform page; with a bank it shows that bank's logo, colour and login picture. `fields.tsx` holds its inputs (`Field`, `PasswordField` with live rule ticks, `SubmitButton`, `Notice`).
- Sign-in (`/login`) is email first: email, then the bank is recognised from the email's domain and the page turns into the bank's page, then password. The device remembers the bank; "Not your bank?" forgets it. An email on no bank's domain gets the platform page with the same steps.
- Register a bank (`/register`): five steps and a review, with "Save and continue later" on the device (the password is never saved). Status page at `/register/status`.
- Invite link (`/invite`) and forced first password (`/set-password`) use the same shell in the bank's colours.
- Platform console (`/platform`): the platform owner's own sign-in, registrations and banks by state, approve, reject, suspend, reactivate, delete.
- Reset data (console): one button removes every bank and its data except Harbor Demo Bank and banks marked Keep. Its dialog lists what goes and what stays, and asks for the phrase RESET DATA. Keep is a switch in the bank panel and a tick box on Approve; a kept bank shows a "Kept" tag and cannot be deleted. The storage bar turns to the warning colour from 80%.
- "Reset all data" in Settings is shown to Harbor Demo Bank users only.
- Lists that a bank can extend without limit (status codes, custom values) never get a fixed row of buttons: use a searchable picker or an overflow menu.

### 3.0 screens
- The front door has no HTML mockups in `design/`; the built pages are the reference.
- The old sign-in design `design/AIO-101/login.html` and its `.lg-` styles are retired.
