# Locator Guide & Practice Checklist

This app deliberately uses a **mixed locator strategy**: some elements have stable `data-testid`
attributes, others must be located by role, text, CSS, or XPath — like a real-world app.

## ⚠️ Difficulty traps (by design)

- **Decoy `id` attributes.** Every input/button/textarea gets an auto-generated `id` like
  `el-x8k2f-3a`. They look usable in devtools, but the salt changes on **every page load** and the
  counter depends on render order — id-based locators WILL break on the next run. Never use them.
- **No test IDs on "+ New …" buttons, search boxes, or Create/save buttons on form pages** —
  locate them by role + accessible name, visible text, or placeholder.
- **Randomized latency (300–1200 ms)** on every read/write. Fixed sleeps will be flaky; use
  explicit/conditional waits (element visible, spinner gone, button enabled, text changed).

## Where test IDs exist

| Area | Test IDs |
|---|---|
| Pages | `login-page`, `dashboard-page`, `leads-page`, `lead-form-page`, `lead-detail-page`, `contacts-page`, `contact-form-page`, `contact-detail-page`, `accounts-page`, `account-form-page`, `account-detail-page`, `products-page`, `product-form-page`, `product-detail-page`, `deals-page`, `deal-form-page`, `deal-detail-page`, `tasks-page`, `tickets-page`, `ticket-form-page`, `ticket-detail-page`, `admin-page`, `settings-page`, `forbidden-page` |
| Login | `login-email`, `login-password`, `login-submit`, `login-error` |
| Chrome | `sidebar`, `topbar`, `sidebar-toggle`, `global-search`, `theme-toggle`, `avatar-menu`, `logout-btn` |
| Toasts / modals | `toast-container`, `toast`, `modal` |
| Leads | `filters-toggle`, `filter-panel`, `bulk-bar`, `pagination`, `export-csv-btn`, `lead-name`, `lead-company`, `lead-email`, `lead-phone`, `lead-status`, `lead-product`, `lead-value`, `lead-save-btn`, `edit-lead-btn`, `save-lead-btn`, `lead-detail-status`, `wizard-finish` |
| Products | `product-name`, `product-sku`, `product-category`, `product-price`, `product-description`, `product-status`, `edit-product-btn`, `save-product-btn`, `new-lead-for-product-btn` |
| Dashboard | `dashboard-range`, `stat-leads`, `stat-pipeline`, `stat-tasks`, `stat-tickets`, `activity-feed` |
| Deals | `kanban-board`, `deal-name`, `deal-account`, `deal-amount`, `deal-stage`, `deal-close-date`, `deal-save-btn`, `edit-deal-btn`, `deal-detail-stage` |
| Tasks | `task-quick-add`, `task-title-input`, `task-due-date`, `task-add-btn` |
| Contacts | `view-grid`, `view-list`, `contact-tabs`, `contact-name`, `contact-email`, `contact-phone`, `contact-title`, `contact-account`, `contact-tags`, `upload-avatar-btn`, `avatar-input`, `edit-contact-btn`, `save-contact-btn`, `note-input`, `add-note-btn`, `attach-file-btn`, `file-input` |
| Accounts | `account-name`, `account-industry`, `account-employees`, `account-revenue`, `account-website`, `account-phone`, `edit-account-btn`, `save-account-btn` |
| Tickets | `ticket-subject`, `ticket-requester`, `ticket-priority-select`, `ticket-description`, `ticket-status`, `ticket-priority`, `sla-countdown`, `canned-response`, `comment-input`, `add-comment-btn`, `ticket-attach-btn`, `ticket-file-input` |
| Admin | `admin-tabs`, `add-user-btn`, `user-name`, `user-email`, `user-role`, `user-save-btn`, `audit-user-filter`, `admin-readonly-banner` |
| Settings | `profile-name`, `profile-email`, `profile-phone`, `profile-save-btn`, `help-iframe`, `reset-data-btn`, `reset-confirm-btn` |
| Deletes | `delete-product-btn`, `delete-account-btn`, `delete-contact-btn`, `delete-lead-btn`, `delete-deal-btn`, `delete-ticket-btn`, `confirm-delete-btn`, `delete-confirm-input`, `delete-blocked-banner`, `closed-won-warning`, `converted-warning`, `reassign-banner`, `reassign-select`, `reassign-delete-btn` |

## Where test IDs deliberately do NOT exist

Locate these by role, text content, CSS, or position:

- **"+ New Lead / Product / Contact / Account / Deal / Ticket / user" buttons** — by role + name or text
- **Search inputs on list pages** — by placeholder or `input[type=search]` in context
- **Create/save buttons on form pages** — by text ("Create lead", "Create product", …)
- **Table rows and cells** — use text (`tr:has-text(...)`) or nth
- **Kanban columns and cards** — use column heading + card title text
- **Custom dropdown options** — `role=option` + text
- **Context menu items** — text (right-click a lead row first)
- **Date-picker days** — button text inside the calendar popup
- **Charts** — SVG structure (`rect`, `circle`, `polyline`), `<title>` tooltips
- **Shadow DOM** — feedback widget internals (`#fab`, `.star`, `#submit`, `#thanks`)
- **iframe** — everything inside Settings → Help center (`#help-search`, `.faq`)
- **Pagination page-number buttons, chip filters, tabs, accordions** — text
- **Toggle switches** — `input[type=checkbox]` inside `.switch`, by row context

## Practice checklist

- [ ] Login: valid, invalid, deactivated user (`priya@crm.com`), empty-field validation, show/hide password
- [ ] Forgot-password 3-step flow (code is `123456`)
- [ ] Route guard: open `/leads` while logged out → redirected to `/login`
- [ ] Role check: log in as `viewer@crm.com` → Admin hidden, `/admin` → 403 page
- [ ] Read-only check: log in as `rep@crm.com` → Admin visible but controls disabled
- [ ] Leads: sort each column, debounced search, multi-select status filter, pagination + page size
- [ ] Leads: select all on page, bulk delete (handle `window.confirm`), bulk assign owner
- [ ] Leads: double-click email cell → inline edit → Enter to save, Escape to cancel
- [ ] Leads: right-click row → context menu → Convert lead → complete 3-step wizard
- [ ] Leads: export CSV and verify the downloaded file
- [ ] Dashboard: wait out skeleton loaders, assert stat tiles, change date range, infinite-scroll the activity feed
- [ ] Deals: drag a card between kanban stages, assert column totals update
- [ ] Deals: create a deal — searchable account select, custom date picker, probability slider, currency formatting on blur
- [ ] Tasks: add task, drag to reorder, complete an overdue task (handle `window.alert`), delete (handle `window.confirm`)
- [ ] Contacts: grid/list toggle, hover-revealed actions, tooltip on truncated email
- [ ] Contact detail: tabs, avatar file upload, tags multi-select, add/delete notes, attach files
- [ ] Accounts: sort/search, open website link in new tab (window handling), nested accordions on detail
- [ ] Tickets: status transitions (only allowed moves are shown), live SLA countdown, canned response fills the comment box
- [ ] Tickets: add/edit/delete comment, file attachment
- [ ] Admin: add user, toggle active switch, audit-log filter
- [ ] Settings: profile validation errors, notification toggles, iframe help center (switch frames, use its search + FAQ accordions)
- [ ] Shadow DOM: open feedback widget, pick a star rating, submit, assert the thanks message
- [ ] Global: theme toggle persists across reload, global search async suggestions, notifications bell badge
- [ ] Reset data via Settings and via `?reset=true`, assert seed state returned
- [ ] Delete checks — product with leads: type-name gate, leads unlinked afterwards
- [ ] Delete checks — account with open deals: blocked with links; without: unlink vs cascade radio
- [ ] Delete checks — Closed Won deal: type DELETE gate; kanban modal refuses with error toast
- [ ] Delete checks — active ticket blocked; Closed ticket deletable with comment/attachment counts
- [ ] Delete checks — converted lead shows "records not deleted" warning
- [ ] Delete checks — user owning records forces reassignment (select gated); self-delete blocked
