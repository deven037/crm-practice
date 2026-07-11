# Practice CRM

A full-featured CRM web app built **specifically as a UI automation practice target** (Playwright,
Selenium, Cypress…). Frontend-only — data lives in `localStorage`, no backend needed.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

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
contacts, 20 accounts, 25 deals, 30 tasks, 15 tickets, 5 users).

- **UI:** Settings → Danger zone → *Reset all data*
- **URL:** open any page with `?reset=true` (e.g. `http://localhost:5173/?reset=true`) — ideal in a test setup hook

All store operations pass through simulated latency (200–800 ms), so loading spinners and
skeletons genuinely appear — your tests must wait properly.

## Modules

Dashboard (charts, infinite scroll) · Leads (full-featured table, inline edit, context menu, bulk
actions, CSV export, convert-lead wizard) · Contacts (grid/list, tabs, avatar upload, tags) ·
Accounts (detail with nested accordions, new-tab links) · Deals (drag-and-drop kanban, custom date
picker, searchable select, slider) · Tasks (drag reorder, native alert/confirm dialogs) · Tickets
(status workflow, live SLA countdown, comments, attachments) · Admin (RBAC, user CRUD, toggle
switches, audit log) · Settings (validation, iframe help center, reset) · plus toasts, global
search, notifications, dark mode, a shadow-DOM feedback widget.

See **[LOCATORS.md](LOCATORS.md)** for the locator strategy map and a practice checklist.

## License

MIT — free to use, publish, and share.
