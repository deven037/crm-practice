# CRM 3.0: multi-bank platform, full redesign

## Context

Today the CRM (`deven037/crm-practice`, React + Vite front end, Express API) serves one bank only:

- All data lives in memory (`server/src/db.ts`, `Collection<T>`), so it resets on every restart.
- The bank's name, logo and colour come from environment variables (`BANK_NAME`, `VITE_BANK_*`), so a second bank needs a second deployment.
- Passwords are stored and compared as plain text (`server/src/routes/auth.ts`).
- The screens follow the older Harbor designs; the Leads list and form were redesigned in this session and you liked that direction.

You want version 3.0: every screen redesigned, many banks on one platform, each bank registering itself (logo, login-page image) and getting its own CRM link, plus the features a real banking CRM has.

Your decisions so far:

- I build it directly; the office team is not involved and stays as it is.
- Everything must run on free services.
- One shared PostgreSQL database, every row tagged with its bank.
- Same repository, module by module.
- No per-bank link. One address for everyone; the user's work email tells the platform which bank they belong to.
- A newly registered bank can use the CRM only after you approve it.
- For Render work, I ask you to sign in to Render in the browser pane and then I operate it there.

## How it stays free

| Need | Choice | Why |
|---|---|---|
| Web address | One site for all banks | No domain purchase, no per-bank setup. |
| Database | Neon free PostgreSQL | Render's free Postgres is deleted after 30 days; Neon's free tier does not expire. |
| Logos and login images | Stored in PostgreSQL, served by the API with caching | No extra storage service. Limit 1 MB logo, 3 MB login image. |
| Hosting | Render free static site + free web service for 3.0 | Same as today. The free API sleeps after 15 idle minutes; first load is slow. |
| Local and test database | PGlite (Postgres running inside Node) | No install, no account, used when `DATABASE_URL` is not set. |

## Where the work happens

- My own clone at `D:\AI Agents Office\workspaces\claude\crm-practice` (no git worktrees, per your rule).
- A long-lived `v3` branch in `crm-practice`. I open small PRs into `v3`; `release` and `main` are not touched, so the office and the live sites keep working.
- A separate free Render pair (`crm-v3` site and `crm-v3-api`) deploys from `v3`, so you can open 3.0 in the browser at any time.
- When 3.0 is complete, one PR merges `v3` into `release`, then `main`.

## Phase 0: setup (needs you once)

1. You create a free Neon account (I do not create accounts or handle passwords).
2. I create the `v3` branch and my clone.
3. You sign in to Render in the browser pane; I then create the two free services there. You paste the Neon connection string into the service's environment setting yourself, so I never see or type it.

## Phase 1: platform core (multi-bank, real storage, real sign-in)

**Bank model.** New tables:

- `banks`: identity (legal name, display name, bank type, licence or registration number, country), contact (head office address, website, contact person, phone, email), sign-in (email domains such as `axisbank.com`), region (currency, locale, timezone), branding (colour), size (branches, expected users), and status: pending, active, rejected or suspended.
- `bank_assets`: logo and login-page image.
- `platform_admins`: you, as platform owner.

**Storage.** Replace the in-memory `Collection<T>` in `server/src/db.ts` with a Postgres-backed version that keeps the same methods (`list`, `get`, `create`, `update`, `remove`), so the 28 route files in `server/src/routes/` change very little:

- One table `records (bank_id, collection, id, data jsonb, created_at, updated_at)`, primary key on the first three columns.
- Each bank's data is loaded into memory on its first request and every write is saved to Postgres straight away. This keeps the API fast on the free tier and the route code synchronous.
- Limit of this approach: it assumes one API instance, which is what the free plan gives. Moving busy collections to real columns is a later step, not part of 3.0.
- `store` becomes per request (`req.store`), chosen from the signed-in user's bank. No route can reach another bank's data.

**Sign-in.**

- Passwords hashed with bcrypt; plain-text comparison removed.
- Sign-in is email first: the user types their work email, the platform matches the email's domain to a bank, shows that bank's logo and image, then asks for the password.
- Matching is by the bank's registered email domain, not by whether the user exists, so the page never reveals who has an account. An unknown domain gets the plain platform login with the same steps.
- If an email matches more than one bank, the user picks from only those banks.
- The device remembers the bank, so the branded login opens directly next time; "Not your bank?" clears it.
- The token carries `bankId` and role (`server/src/middleware/auth.ts`). Users of pending, rejected or suspended banks cannot sign in and see a clear message.
- Invite links for new users, forced password change on first sign-in, password rules, sign-out everywhere.

**New API routes.**

- `POST /api/auth/identify`: takes an email, returns the matching bank's name, logo, login image and colour (rate limited, no sign-in needed).
- `POST /api/platform/banks`: register a bank; it is saved as pending (rate limited).
- `/api/platform/*`: platform owner console (list, approve, reject, suspend, delete banks).
- `bootstrap.ts`: bank profile comes from the database, not from env vars.

**Seed.** `server/src/seed.ts` becomes "sample data for a new bank": each registered bank can start empty or with demo data.

**Tests.** Add API tests that prove bank A cannot read, change or search bank B's records, for every collection.

## Phase 2: design system 3.0 and the front door

**Design system.** Rewrite `src/styles.css` tokens and the shared components (`src/components/`: `Layout`, `Select`, `Modal`, `SlideOver`, `Tabs`, `Toast`, `DatePicker`, `ViewsToolbar`, `BulkActionsBar`, `Kanban`, `charts`) in the style of the Leads mockups you approved: one bank colour drives the theme, light and dark, phone layouts, keyboard focus.

**Look and motion.** 3.0 should feel alive, not flat. The Leads mockups shown earlier were static and plain; the real designs add depth and movement:

- *Richer surfaces.* Layered panels with soft shadows, a gentle tint of the bank's colour in the background, translucent glass for the top bar, menus and side panels (the direction of your "Glassy Dashboard V18" reference), and illustrations for empty pages.
- *Signature moment on sign-in.* When the email is recognised, the plain platform page turns into the bank's page: the bank colour sweeps in, the logo settles into place and the bank's image slides in on the right.
- *Page and panel movement.* Pages cross-fade and slide when you move between modules; record panels slide in from the side; dialogs and menus scale up from where you clicked.
- *Lists and boards.* Rows appear in a quick cascade on first load; cards on the Deals board lift, tilt slightly and settle when dragged; a moved card glides to its new column.
- *Numbers and charts.* Dashboard figures count up; bars and lines draw themselves in; the status strip on Leads re-sizes smoothly when a filter changes.
- *Small feedback.* Buttons press in, toggles spring, saved records show an animated tick, loading uses shimmering placeholders shaped like the content instead of spinners.
- *Rules.* Motion is fast (150 to 350 ms), never blocks a click, runs smoothly on ordinary laptops, and switches off for users whose device asks for reduced motion.

Built with the free Motion library for React plus the browser's built-in page transitions; no paid tools.

**Routing.** Page addresses stay as they are (`/leads`, `/deals`); the bank comes from the signed-in user, not the address. The site root is the email-first sign-in with a "Register your bank" link.

**Bank registration (5 steps, with save and continue later).**

1. Bank details: legal name, display name, bank type (commercial, co-operative, small finance, NBFC, other), licence or registration number, country.
2. Contact: head office address, website, contact person, phone, email.
3. Branding: upload logo, upload the login-page right-side image, pick brand colour, with a live preview of the login page.
4. Setup: email domains for sign-in, currency, locale, timezone, number of branches, expected users, and whether to start with sample data.
5. First admin user, then a review page and submit.

After submitting, the bank sees "Waiting for approval" and can check the status with the admin's email.

**Approval.** The registration appears as pending in your platform console with all its details. You approve or reject (with a reason). On approval the bank's admin can sign in. Until a mail service is added (group C), the bank checks its status on the site rather than getting an email.

**Branded login.** After the email step, the page shows the bank's logo and form on the left and its uploaded image on the right.

**Bank settings.** Admins can change logo, image, colour and details later.

**Platform console.** For you as platform owner: pending registrations, all banks, users and records per bank, approve, reject, suspend or reactivate.

## Phase 2b: Reset Data in the platform console (added 2026-11-16, before Phase 3)

The platform will be used by test automation, and the free Neon database is small (about 0.5 GB; exact limit to confirm). Test runs must not fill it. Agreed with the owner on 2026-11-16:

- **Automation runs against Harbor Demo Bank only**, using the reset that already exists (`POST /api/reset`, "Reset all data" in Settings, `?reset=true`). That reset is not changed.
- **Everything else is cleaned with one button in the platform console.** No test-bank markers, no automation key, no automatic clean-up job, no per-bank reset.

To build:

1. **Reset Data button** in the platform console (`/platform`), platform owner only. It removes every bank and all of its data (users, records, logo and login picture), except Harbor Demo Bank and banks marked Keep. Harbor Demo Bank is left exactly as it is; its sample data is not reset by this button.
2. **Confirmation.** Before anything is removed, a dialog shows two lists: banks that will be removed (with user and record counts) and banks that are kept. The owner types a confirmation phrase to continue. There is no undo, and the dialog says so.
3. **Keep switch per bank.**
   - Where: in the bank's detail panel in the console, labelled "Keep this bank when resetting data". It saves at once. Kept banks show a "Kept" tag in the list.
   - Effect: Reset Data skips a kept bank, and the single Delete button for that bank is disabled until Keep is turned off. Users of the bank see no difference; Suspend and Reactivate still work.
   - Defaults: off for every new bank, so banks that tests register are cleared with no extra step. Harbor Demo Bank is always kept and has no switch.
4. **"Keep this bank" tick box on Approve.** Approving a registration asks whether to keep the bank, so a real bank is protected from the moment it is approved. Unticked by default.
5. **Settings reset button fix.** "Reset all data" in Settings is shown only to Harbor Demo Bank users; today every bank sees it and it resets the demo bank.
6. **Database size in the console.** Size used against the free limit, with a warning at 80%, so the owner can see when a reset is due.
7. **Tests.** API tests: Reset Data needs the platform owner's sign-in; it never removes Harbor Demo Bank or a kept bank; a kept bank cannot be deleted singly; after Reset Data no row of a removed bank remains in any table. Front-end unit tests for the two confirmation lists.

Known limit, accepted: tests of the front door itself (register, approve, reject a bank) still need a manual approval in the console, so they are not run unattended.

## Phase 3: every module redesigned

One PR per module, in this order. Existing `data-testid` values are kept wherever the element still exists, so the Playwright suite keeps most of its value.

1. App shell: sidebar, top bar, command bar, notifications
2. Leads: list, form, record, convert, triage (designs already started)
3. Contacts
4. Accounts, rebuilt as Customer 360
5. Deals: pipeline board, list, record
6. Activity, Tasks, Calendar
7. Tickets with SLA
8. Products and Quotes
9. Campaigns
10. Dashboard
11. Search
12. Setup and ToolBox: custom fields, status codes (with a colour per code), assignment rules, dedupe rules, import, AutoFlow, roles, users, audit log; plus **Customise page layout** in every module's ToolBox (below). Page layouts are not part of Setup (owner, 2026-11-19). The Setup design (`design/v3/setup.html`) also carries three group A items, because Setup is where they are set: Branches & teams (regions, branches, teams; what "Branch" scope means), maker-checker approvals as a rule kind in Rules, and the Recycle bin (30 days, restore).

### Customise page layout (module 12, owner 2026-11-19)

Where it lives:
- Only in each module's ToolBox, as the menu option **Customise page layout**. It is not in Setup, and there is no other way in.
- It works the same in every module that has records: Leads, Contacts, Accounts, Deals, Products, Quotes, Campaigns, Tickets, Tasks and Meetings, and later custom modules. It is built once and reads each module's fields and cards from the bank's settings, so a new module or field needs no new code.
- Fields are created in Setup → Modules & fields. The layout only places fields that already exist; its field list links to Setup to make a new one.

Layout list (what opens from the ToolBox):
- The module's layouts as cards. Each card shows the name, the product or record type, who it is for, its pages, when it was last changed and by whom, whether it is the default, and how many records use it.
- A **New layout** button opens a full-page form (not a slide window): layout name, description, products (optional, for example Home Loan), who can choose it (roles, branches), "start from" (basic or a copy of an existing layout), the pages it has, and "default layout for this module". Saving makes a new card.
- From a card: open, duplicate, rename, make default, switch off, delete. Delete asks first and says how many records use the layout; those records move to the default layout.

Pages inside a layout:
- Opening a card shows the layout's pages as tabs across the top, for example **New/Edit**, **Detail** and **History**. These are examples: the admin can add, rename, reorder and remove pages. New/Edit and Detail are always there.
- Each page is designed on its own. New/Edit and Detail do not have to match.
- New and Edit are always one page, the same form for creating and editing a record.
- Inside a page the admin can:
  - add, rename, reorder and remove tabs (for example Personal, Loan, Documents), and limit a tab to some roles;
  - add sections inside a tab, with one or two columns;
  - drag fields from the field list onto the page, and drag them to move them;
  - on Detail and other record pages, drag cards from the card library (Details, Stage path, Figures, History, related lists such as Quotes) and drag a card's edges to set its width and height (this settles the owner's 2026-11-17 card library idea);
  - set, for each field on this layout: required here, read-only here, help text, and "show only when" (for example show Collateral value only when Product is Home loan or Gold loan).
- The editor is a live picture of the page: fields and cards show with a sample record's values while they are dragged, with a desktop and phone view and "preview as" a role.

Making it better (my additions):
- **Choosing a layout (owner, 2026-11-19):** the person creating a record picks its layout in the "Choose a layout" sheet on New, in every module; nothing picks it automatically. The record keeps that layout for good (its form, record page and other pages). The admin sets, on the Layouts screen: the order of the sheet (drag), who sees each layout in it (roles, branches), and the default, which starts selected and is used for records made by import or the API. Switched-off and unpublished layouts are not offered. With only one choice the sheet is skipped. A "Preview as" role and branch shows the sheet as that person sees it, and why other layouts are not offered. A layout's products are shown in the sheet and limit its Product field.
- **Categories (owner, 2026-11-19):** every layout is in one category, and "Choose a layout" shows layouts under their category headings. The Layouts screen stays one grid of cards; each card shows its category (owner, 2026-11-19: no grouping there). A "+ New category" button beside "+ New layout" opens the Categories page, the only place a category is made: name, description, colour, a preview of the heading; categories can be renamed, dragged into the order the headings appear, and deleted (their layouts move to a category the admin picks; the last category can't go). The New layout form has a required Category field, with a link to make a new category without losing the half-filled form. In the sheet a layout can be dragged only within its category.
- **Edit details (owner, 2026-11-19):** every layout has "Edit details" (card menu, and a button beside its name in the editor). It opens the same full-page form as New layout, filled in: name, description, Category, products, who can choose it, default; no "start from"; pages are shown and changed in the layout itself. Saving applies at once (page changes still wait for Publish) and returns to where it was opened from.
- **Draft and publish,** as in Setup: changes stay in draft and only admins see them; publishing makes a new version with a note; any version can be rolled back.
- **Checks before publishing:** a required field missing from New/Edit, an empty tab or section, a field placed on a page but hidden from every role that can see the page, and a "show only when" that points at a field not on the page.
- **Undo and redo** while editing, and a "compare with published" view.
- Old layouts (today's form tabs and Layout Designer) carry over as cards when this ships, with their New/Edit tabs as they are; the old Setup Layout Designer pages are removed.
13. Data Studio (upgraded, see below)

For each module I show you the design here first, as in this session, then build it.

### Data Studio upgrade

Today Data Studio (`src/pages/DataStudio.tsx`, `AnalysisResults.tsx`, `server/src/routes/analysis.ts`) lets a user pick a module's fields, preview rows and run a Python script, either through a helper program on their own computer (`python_bridge/`) or through a shared GitHub repository (`crm-data-science-lab`). Neither works for many banks: the helper needs a local install, and the shared repository would mix different banks' data in one place.

In 3.0 it becomes a full analysis workspace that needs no install and keeps each bank's data separate:

- **Dataset builder.** Pick a module, choose fields, filter, combine related modules (for example leads with their deals), and add calculated columns. Saved per bank in the database.
- **Data quality report.** For any dataset: missing values, duplicates, unusual values and field types, shown before analysis.
- **Cleaning steps without code.** Trim text, drop blanks, remove duplicates, fix types, rename columns, as a list of steps that can be re-run.
- **Chart builder.** Bar, line, pie, funnel and table summaries from any dataset, saved and shareable inside the bank.
- **Python in the browser.** A notebook-style editor that runs Python with pandas inside the user's own browser (Pyodide, free). The data never leaves the bank's session, nothing to install, and it replaces both the local helper and the GitHub route.
- **Results and history.** Each run keeps its output tables, charts and cleaned dataset; a cleaned dataset can be reused as a new source.
- **Export.** CSV and Excel, controlled by the export permission.
- **Link to reports.** Charts built here can be pinned to the Dashboard, so Data Studio is also the home of the report builder in group B.

`python_bridge/` and the GitHub analysis route are retired at the final switch-over; until then they stay as they are on `release` and `main`.

## Phase 4: new features for a real banking CRM

Grouped by priority. Group A is part of 3.0; B and C follow in order unless you reorder them.

**A. Core (in 3.0)**

- Customer 360: one page per customer with products held, deals, tickets, activity timeline and documents.
- Branches and teams: bank branches, regions, team hierarchy; record visibility by branch.
- Roles and permissions per module and action (view, create, edit, delete, export).
- Maker-checker approvals: a second person approves sensitive changes (large deals, quote discounts, deletions).
- Documents: attach files to any record (stored in Postgres, size limited).
- Notes with @mentions, and in-app notifications.
- Saved views and filters per user, shareable with the team.
- Import wizard (CSV with column mapping and duplicate check) and export.
- Recycle bin: restore deleted records for 30 days.
- Full audit trail: who changed what, when, old and new value.
- *Added 2026-11-17, customisation foundations (every screen is built on these, so they come with the Setup module):*
  - One shared formula language for formula fields, validation rules, workflow conditions, scoring and default values, with a tester.
  - Dependent picklists (product → sub-product, state → city) and shared picklists used by many fields.
  - Record types: for example Home Loan, Car Loan and Gold Loan inside Deals, each with its own layout, stages and picklist values.
  - Draft and publish for settings: changes stay in draft until published (the free alternative to a paid sandbox).
- *Added 2026-11-17, storage guardrails (see "Storage and automation rules" below):* file allowances per bank, automatic clean-up of logs, reset coverage for every new kind of data, and a database size breakdown in the platform console.

**B. Banking workflows**

- KYC and onboarding checklist per customer, with document collection and expiry reminders.
- Loan and product application pipeline: application, verification, approval, disbursal, with stage rules.
- Targets and forecasting per rep, branch and product.
- Consent and do-not-contact register, checked before any campaign.
- Reports and dashboard builder: pick a module, group, chart, save and share.
- Calendar with meetings and reminders.

**C. Later**

- Email templates and sequences (needs a mail service; Brevo's free tier allows 300 a day).
- Two-step sign-in with an authenticator app.
- API keys and webhooks per bank.
- AI help: lead scoring, record summaries, next best action (the model calls cost money, so this is not free).
- Installable phone web app. The existing Expo app in `mobile/` is left as it is.

*Groups D and E were added on 2026-11-17 after checking for overlap with A to C and Phase 3. Everything in them is free and follows the storage and automation rules below.*

**D. Customisation (every aspect, not only colour)**

- *Data model:* more field types (lookup, formula, roll-up, auto-number, multi-select, file); custom modules (Loan Application, Collateral, Locker) with list, form and record page, stored in the existing `records` table; relationships between modules with related lists on record pages; rename modules and fields; hide modules a bank does not use.
- *Apps:* an app builder that combines a custom module with its pages, pipeline, rules and automations into one named app (for example "Gold Loans") with its own side-menu section; switched on or off as a unit, shared with chosen roles or branches, copied to another bank from the platform console. Industry packs can include ready-made apps.
- *Record pages (added 2026-11-17, owner; builder moved into module 12 on 2026-11-19, see "Customise page layout" in Phase 3):* every detail page is built from a card list stored in the bank's settings, not fixed code, from Phase 3 Deals onwards (earlier modules move to it when the builder arrives); the record page builder edits that list. It lives only inside **Customise page layout** in each module's ToolBox (no separate "Customise this page" entry anywhere, and not in Setup). In it an admin can add, remove, reorder and resize cards; set what each card shows (for example which fields the Details card lists, how many history events show before scrolling, which related records a related list shows); and keep a different record page per record type and per role (for example a Security card for credit officers only). Personal card arrangements per user are not planned: the layout is set by admins for the whole bank (or branch, through branch overrides).
  - *Owner idea (2026-11-17), settled 2026-11-19:* a card library where cards are made once for any module; Customise page layout places those cards on a page, and the admin drags a card's edges to set how much space it takes.
- *No "custom" markers (owner, 2026-11-17):* anything a bank creates (fields, stages, status codes, picklist values, cards, modules) looks exactly like a built-in item to users. No "your bank", "custom" or similar tag anywhere, Setup screens included (today's Setup pages still show "(custom)" in Assignment Rules, Dedupe Rules and the Layout Designer, and "Custom" in Roles; those go when Setup is redesigned in module 12).
- *Screens:* conditional fields and sections; record page builder (see Record pages above); which fields show on board cards, list rows and hover previews, with colour rules (for example red border when overdue); board grouping by any picklist; side menu order and visibility per role; every label, button text, empty message, error message and help tooltip editable per bank and language; announcement banner and sign-in page messages.
- *Rules and process:* validation rules; stage rules (required fields before a stage, blocked backward moves); workflow actions without code (update a field, create a task, notify, assign, call a webhook), extending AutoFlow; scoring rules without code; custom buttons and quick actions on records; multi-step form builder (turn any create form into a guided wizard); SLA and escalation rules per ticket type, extending "Tickets with SLA"; configurable approval processes extending group A's maker-checker (several steps, approvers chosen by amount, branch or product, escalation when nobody acts); bank-level notification rules (which events notify which roles).
- *Regional and business settings:* number format (lakh and crore, or million), date format, fiscal year start (April in India), working hours and holidays per branch, used by SLAs, reminders and reports. Users can override date format, time zone and language for themselves.
- *Reports:* extending group B's report builder with custom report types that join related modules (contacts with their deals and tickets), calculated KPIs defined once and reused across dashboards, and saved export templates (columns, order, format).
- *Advanced scripts (optional, per bank):* small custom scripts for custom buttons and calculated values, run in an isolated script engine inside the user's browser, with a time limit and no network access. Never run on the server.
- *Picklists and numbering:* a colour and icon per value of any picklist (Phase 3 covers status codes only); retire a value without breaking old records; custom record numbers (LD-PUN-2026-00042) and display names.
- *Access:* field-level permissions and masking (PAN shown as XXXX1234 unless allowed); sharing rules (for example deals over ₹1 crore visible to the credit team); branch overrides of the bank's setup (bank → region → branch).
- *Settings management:* version history with roll back (last 20 versions per settings area, one draft at a time); dependency check before deleting a field or rule; industry packs (commercial bank, co-operative bank, NBFC, microfinance), kept in code; copy a setup to another bank from the platform console; export and import a bank's setup as a file.
- *Per user:* start page, pinned modules, default views, personal dashboards, personal quick-create actions in the command bar, density, text size, keyboard shortcuts, notification choices and quiet hours.
- *AI-drafted setup:* the admin describes a change ("Add a Gold Loan module with purity and weight", "Assign home loan leads from Pune to the Baner branch") and a small AI model in the browser drafts the fields, layout, stages or rule for the admin to review and save.

**E. Current features (all free)**

- *AI in the browser:* record summaries, plain-language search, note clean-up, next-best-action hints (rules first). The model runs on the user's device, so it is free and the data stays on screen. Group C's paid AI stays as an optional upgrade.
- *Documents:* read KYC documents and visiting cards from a photo in the browser (Tesseract.js), a person confirms the values, only the values are kept (a photo, if kept, is shrunk to about 300 KB first); format checks for PAN, GSTIN, IFSC and pincode using free public lists; PDF document templates (sanction letters, quotes, welcome letters) in the bank's letterhead, generated on demand and never stored.
- *Live teamwork:* records update on everyone's screen; "who is viewing this record" presence. Nothing stored.
- *Field staff:* offline notes that sync later (extends the installable phone web app in C); visit check-in on a map and a day route (OpenStreetMap, light use); voice notes turned into text by a speech model in the browser (not Chrome's built-in recognition, which sends audio to Google), text only, audio never stored; push reminders (web push).
- *Customers:* self-service portal (track an application, upload documents, raise a ticket), with uploads inside the bank's file allowance; branch appointment booking; signature drawn on screen for acknowledgements (not a certified e-sign); UPI payment links and QR codes; WhatsApp click-to-chat links with message templates and merge fields; web forms a bank designs for its own website ("Apply for a loan"), each submission becoming a lead, protected by rate limits, a hidden spam trap and a daily cap per bank.
- *Calendar feed:* each user gets a private calendar link, so CRM meetings and reminders appear in Google or Outlook calendar (read-only feed, nothing stored).
- *Sign-in and privacy:* passkeys (fingerprint or face) alongside the authenticator app in C; DPDP Act tools ("give me my data", "delete my data", retention rules, breach register), extending the consent register in B; export watermarks; signed-in device list and idle timeout.
- *Insight:* branch leaderboards and streaks, anomaly alerts, customer health score, scheduled reports (in the app; by email once C's mail service exists). All calculated when opened, never stored.
- *Platform care:* error tracking on Sentry's free plan (the owner creates the account); guided tours and a "What's new" panel; full keyboard and screen-reader support; Hindi and other languages, with translations checked by a person and kept in code.

**Left out on purpose:** website chat widget (public spam could fill the database, and the sleeping free API cannot hold live connections); saved audio; anything paid or regulated (paid sandbox, automated WhatsApp or SMS, certified e-sign, video KYC, credit bureau checks, Account Aggregator, core banking connectors); pinging the API to keep it awake (may break Render's free-plan rules), which also rules out an uptime monitor or status page that pings it; duplicate hints (dedupe rules already planned); threaded comments (covered by notes with @mentions); a feedback button (the app already has one).

## Storage and automation rules (added 2026-11-17)

The free Neon database is 512 MB and test automation runs on the same platform, so every feature follows these rules.

**Storage**

- Settings (modules, rules, layouts, picklists, formulas) are small and stored per bank. Industry packs and translations live in code; only a bank's own changes are stored.
- Records stay in the shared `records` table, custom modules included. Formula and roll-up fields are calculated when shown, not stored.
- Files (documents, portal uploads, signatures, kept photos) have a size limit per file and a total allowance per bank, shown in bank settings and the platform console.
- Logs clean themselves up: notifications after 30 days, check-ins after 1 year, the record audit trail after a period the owner sets (for example 1 year), the recycle bin after 30 days, settings versions after the last 20.
- Reports, leaderboards, health scores, anomaly alerts, PDFs and calendar feeds are produced when opened and never saved.
- Apps, scripts and exported setups are settings: a few KB per bank.
- Web form submissions are capped per bank per day, so public spam cannot fill the database.
- The platform console's database size display gets a breakdown (files, logs, records) next to the existing 80% warning.

**Automation**

- Every new kind of data carries the bank id, so Reset Data in the platform console removes it for every bank except Harbor Demo Bank and kept banks.
- Harbor Demo Bank's reset also clears its logs (audit trail, settings versions, notifications, recycle bin, files) and restores the default setup, so a test that creates a custom module or rule leaves nothing for the next run.
- API tests prove that after either reset no leftover row remains in any table.
- Test files (for example KYC photos) are tiny fixtures.
- Device features are tested with simulated devices: passkeys, location and offline mode in Playwright; AI, document reading, voice and push with stand-in results, so automation never downloads AI models. Checks on real phones and laptops stay manual.

## What I am leaving alone

- The office, its agents, Jira and the current sprint work.
- `release` and `main` branches and the live staging and production sites.
- `mobile/` (the Expo phone app).

## Verification

- **Each PR:** `npm test` in the root and in `server/` (existing Vitest and contract tests plus the new ones), `npm run build` for both.
- **Bank isolation:** automated API tests register two banks and prove neither can see the other's data.
- **In the browser:** I run the app locally, register a bank (for example Axis Bank) with a logo and login image, approve it in the platform console, type an Axis email on the sign-in page to see the branded login, sign in, and walk each redesigned module at desktop and phone width, in light and dark. Screenshots are shared with you in the chat.
- **On Render:** after each merge into `v3`, check the `crm-v3` site: restart the API and confirm the bank, its images and its data are still there.

## Open points I will settle as we go

- Product name stays "Harbor CRM" unless you want a new one for 3.0.
- Bank registration is open to anyone and rate limited, but nothing is usable until you approve it. Email verification and approval emails wait for the mail service in group C.
- Users whose email is not on their bank's domain (for example a contractor on Gmail) sign in through "Choose my bank by name", which asks for the bank's exact display name rather than showing a list.
- Typeface: Bricolage Grotesque with IBM Plex Sans, as in the mockups, self-hosted in the app.
