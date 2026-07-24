# Practice CRM

A full-featured CRM web app built **specifically as a UI *and* API automation practice target**
(Playwright, Selenium, Cypress, Postman, RestAssured, pytest…). The React frontend is backed by a
real REST API (`server/`) — records created via the API show up in the UI, and vice versa.

## Quick start

Run both the frontend and the API (two terminals):

```bash
npm install
npm run dev              # frontend — http://localhost:5173
```

```bash
cd server
npm install
npm run dev               # API — http://localhost:4000
```

`vite.config.ts` proxies `/api/*` to the API in dev, so no CORS setup is needed locally. See
**[server/README.md](server/README.md)** for the API's endpoints, Swagger UI (`/api/docs`), auth,
and deployment.

Production build: `npm run build`, then `npm run preview`.

## Demo credentials

Password for all users: **`Pass@123`**

| Email | Role | Access |
|---|---|---|
| `admin@crm.com` | Admin | Everything, user management |
| `rep@crm.com` | Sales Rep | Everything, read-only admin |
| `viewer@crm.com` | Viewer | No admin (403) |
| `priya@crm.com` | Rep (deactivated) | Login blocked — for negative tests |

Forgot-password flow: the reset code is always `123456`.

## Resetting test data

The seed data is **deterministic** — every reset produces identical records (~50 leads, 40
contacts, 20 accounts, 12 products, 25 deals, 30 tasks, 15 tickets, 5 users, 8 campaigns, 15
quotes).

- **UI:** Settings → Danger zone → *Reset all data*
- **URL:** open any page with `?reset=true` (e.g. `http://localhost:5173/?reset=true`) — ideal in a test setup hook
- **API:** `POST /api/reset` — no auth required, so it can be the first step of an API test suite too

All API calls pass through simulated latency (300–1200 ms server-side), so loading spinners and
skeletons genuinely appear — your tests must wait properly. The app is tuned to **intermediate
automation difficulty**: every input/button carries a decoy auto-generated `id` that changes on
each page load (never use them), and common buttons/search boxes intentionally have no test IDs —
see [LOCATORS.md](LOCATORS.md) for the traps and the recommended strategies.

## API for automation practice

`server/` is a standalone Node/Express REST API — the CRM's single source of truth. It covers all
8 business modules (Leads, Contacts, Accounts, Deals, Products, Tickets, Campaigns, Quotes) plus
Users/Auth, Tasks, Notifications, and the Custom Fields/Layouts config, with:

- Bearer-token auth (`POST /api/auth/login`), role-based 403s, rate-limited login attempts
- Pagination/filtering/sorting on every list endpoint, structured 400/422 validation errors
- Business-rule-aware endpoints: lead conversion, quote/ticket status transitions (409 on illegal
  moves), account cascade-vs-unlink delete, deal Closed-Won delete confirmation
- An OpenAPI 3 spec + Swagger UI at `/api/docs` — importable straight into Postman/Insomnia

See **[server/README.md](server/README.md)** for the full endpoint list and deployment notes.

## Modules

Dashboard (charts, infinite scroll) · Leads (full-featured table, inline edit, context menu, bulk
actions, CSV export, convert-lead wizard, detail page) · Contacts (grid/list, tabs, avatar upload,
tags) · Accounts (detail with nested accordions, new-tab links) · Products (catalog linked to
leads — each product's detail page lists the leads generated for it) · Campaigns (channel/budget/
date tracking, ROI computed from linked Closed Won deals, reverse-lookup of generated leads) ·
Quotes (line-item builder with live computed totals, cascading Account→Deal select, status
workflow, accepting a quote can auto-close its linked deal) · Deals (drag-and-drop kanban, custom
date picker, searchable select, slider, detail page) · Tasks (drag reorder, native alert/confirm
dialogs) · Tickets (status workflow, live SLA countdown, comments, attachments) · Admin (RBAC, user
CRUD, toggle switches, audit log, Object Configuration for per-module custom fields and drag-and-
drop page layouts) · Settings (validation, iframe help center, reset) · plus toasts, global search,
notifications, dark mode, a shadow-DOM feedback widget.

Creating a record (lead, contact, account, product, deal, ticket) uses a dedicated form page and
lands on the new record's **detail page** — not back on the listing — like a real CRM.

See **[LOCATORS.md](LOCATORS.md)** for the locator strategy map and a practice checklist.

## License

MIT — free to use, publish, and share.
