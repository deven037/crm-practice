# Harbor CRM 3.0: handoff (2026-11-19)

Written for the next agent (Codex) taking over from Claude. Read this first, then `docs/v3/PLAN.md` (the full CRM 3.0 plan the owner approved) and the approved design files in `design/v3/`.

## 1. Where things stand

| # | Module | State |
|---|--------|-------|
| 0–2b | Platform core, front door, test data | Merged into `v3`, live on Render |
| 3.1 | App shell | Merged |
| 3.2–3.10 | Leads, Contacts, Accounts, Deals, Activity/Tasks/Calendar, Tickets with SLA, Products and Quotes, Campaigns, Dashboard | Merged (PRs #140–#148) |
| 3.11 | Search | Merged (PR #149, `v3` at `6dd0125`) |
| **3.12** | **Setup + Customise page layout** | **Designs APPROVED by the owner on 2026-11-19. Build not started.** |
| 3.13 | Data Studio | **Wait.** The owner rejected the first design and will say what he wants. Do not design or build it until he does. |

**Next job: build module 12** from the two approved designs:

- `design/v3/setup.html`: the Setup module.
- `design/v3/page-layout.html`: Customise page layout (opened from each module's ToolBox), including the layout Categories page and the "Choose a layout" sheet shown on New.

Both design files are on branch **`v3-setup`** (last commit `36a54fd`), which is cut from `v3` at `6dd0125` and pushed. Build on that branch (or branches cut from it) and open PRs into **`v3`**. Open the HTML files in a browser: every screen is interactive and is the spec. The script inside each file shows the intended behaviour (validation, messages, edge cases).

## 2. Repository and branches

- Repo: `deven037/crm-practice` (private, GitHub). Local clone: `D:\AI Agents Office\workspaces\claude\crm-practice`.
- `v3` is the long-lived 3.0 branch. `release` and `main` are the old 2.x app: **do not touch them** until the final switch.
- One branch and one PR per module (or per part of a module) into `v3`. The **owner merges** PRs himself. Do not merge.
- After a PR merges, the owner checks it on Render: `harbor-crm-v3` (front end) and `harbor-crm-v3-api` (API), with Neon Postgres. The free API sleeps after 15 idle minutes, so the first request is slow. That is known and the owner said to leave it.

## 3. Owner rules (follow all of them)

Design and process:
- **Design first, then build.** Every module's design is shown to the owner and approved before building. Module 12's designs are approved; do not redesign them.
- **Every module looks different**, with its own layout and main idea, while sharing the shell, colours and components. **Setup must look like a workshop, not a module**: blueprint grid, IBM Plex Mono for keys and counts, a settings index on every Setup screen, and an amber-striped draft bar.
- Designs need depth and motion (Motion library), not flat static screens.
- **Record create/edit forms are full pages, never slide-over panels.** The right-side sheet is only for layout selection ("Choose a layout" on New).
- **Nothing opens by itself.** Side panels and quick-looks stay closed until clicked.
- **No "custom" or "your bank" tag** on anything a bank creates (fields, stages, picklist values, cards, modules), in Setup too. Bank-made items look exactly like built-in ones.
- **No count badges** beside modules in the side menu.
- **No shared "New"/create button in the shell.** Each module has its own create button. (The `>` actions in Search were approved as part of the Search design.)
- The profile menu sits at the top right of the top bar.
- Bank-configurable lists (status codes, picklists) can grow: use searchable pickers or overflow, never fixed button rows.
- Never hard-code module names, stages, field lists or menu order. Read them from the bank's settings.
- **Everything must be free** (Render free tier, Neon free Postgres, PGlite locally). The database is small (about 512 MB), so add no heavy logs. Demo-bank reset must clear anything new.
- **Finish each phase fully** (built, tested, merged) before starting the next. No leftovers.
- The owner tests carefully. **Test every control in the browser before saying something works**, including phone width and dark mode.

Page layouts (decided 2026-11-19, see PLAN.md, section "Customise page layout"):
- Page layouts are **not in Setup**. They live only in each module's **ToolBox → Customise page layout**, built once and working the same in every module.
- **The person creating a record chooses its layout** in "Choose a layout" on New. Nothing picks a layout automatically. The record keeps that layout for good. Admins set the sheet order, who can choose each layout (roles, branches), and the default (pre-selected; also used for import and API).
- A layout has **pages** (New/Edit, Detail, History, and any page the admin adds). Each page is designed separately with its own tabs. New and Edit are always the same page. New/Edit and Detail cannot be deleted.
- **Categories:** every layout is in one category. "Choose a layout" shows category headings. The **"+ New category"** button beside "+ New layout" opens a Categories page, the **only** place a category is made, renamed, ordered or deleted. The New layout form has a required Category field. The Layouts screen is **one grid of cards** (no grouping), each card showing its category.
- Every layout has **Edit details** (card menu, and a button in the editor). It opens the New layout form filled in (Category included), with no "start from".
- Fields are created only in Setup → Modules & fields. Layouts only place them.

## 4. What module 12 contains (from the approved designs and PLAN.md)

Setup (`setup.html`), screens in the settings index:
1. **Blueprint**: map of modules (counts, health), "Needs a look" checks, versions, quick builds.
2. **Modules & fields**: field table plus an inspector. 12 field kinds (text, number, currency, date, picklist, multi-select, checkbox, lookup, **formula**, **roll-up**, **auto-number**, file). The formula editor has a live tester. Each field has record types, "who can see it" per role (Edit / Read / Masked / Hidden), "used in", and a delete with dependency check. Tabs: Record types, ToolBox.
3. **Picklists & stages**: shared lists, a colour per value, drag reorder, Won/Lost meaning, per record type switches, and a **dependent picklist** matrix.
4. **Rules**: Assignment, Duplicate check, Validation, Stage rules and **Approvals** (maker-checker), written as WHEN / IF / THEN sentences with a "test on a record" panel.
5. **Users & roles**: permission matrix (None / Own / Branch / All per module × View, Create, Edit, Delete, Export), sensitive-field masking, and the people list with an inline invite.
6. **Branches & teams**: regions → branches → teams. Defines what "Branch" scope means.
7. **Import**: CSV column matching with confidence, duplicates (skip / update / create), and row errors.
8. **History & audit**: published setup versions with a diff and roll back, plus the audit log.
9. **Recycle bin**: 30 days, restore.
10. **Draft and publish** across all of Setup: changes stay in a draft only admins see, and "Review & publish" creates a new version.
11. Bank profile, SLA policies and Quote settings keep their existing pages (links in the index).

Customise page layout (`page-layout.html`):
- Layouts screen (cards plus a "Choose a layout" preview with *Preview as* a role and branch), New layout form, Edit details, Categories page, and the editor:
  - page tabs and inner tabs (with roles)
  - New/Edit sections of 1–3 columns, with fields dragged in
  - record pages as cards on a 12-column grid (drag from the card library, resize by edges)
  - per-field settings on the layout: required here, read-only here, help text, show-only-when
  - sample record, Preview as, phone view, undo/redo, compare with published, checks (a required field missing from New/Edit blocks publishing), per-layout versions and publish
- "Choose a layout" sheet on New in **every module**, grouped by category. It is skipped when only one choice exists.
- Existing data to migrate: `PageLayout` (`server/src/types.ts`) has `tabs` (form tabs with field keys) and optional `cards`. Records already store `layoutName`. Today's Layout Designer pages (`src/pages/LayoutDesigner*.tsx`) and old Setup pages are replaced. Keep `data-testid`s where an element survives.

**Suggested build order (separate PRs into `v3`, each fully tested):**
1. **12a Server foundations:** settings draft/publish and versions, field types incl. a safe formula evaluator (calculated when shown, not stored), record types, dependent picklists, permissions with scopes, branches/teams, approval rules, recycle bin, layout model (pages, categories, per-layout versions). Add contract tests.
2. **12b Setup screens** from `setup.html`.
3. **12c Customise page layout + "Choose a layout"** in every module, from `page-layout.html`.

Ask the owner before merging these into one or splitting them further. Flag anything in the designs that cannot be built for free.

## 5. How the code is organised (patterns to keep)

- **Server** (`server/`): Express + zod. Each bank's data sits in memory per request and is flushed to the `records` table (Postgres on Render, PGlite locally). `server/src/db.ts`: the `Store` with one `Collection` per name. **A new collection must be added to `COLLECTION_NAMES`, the `Store` class, `reset()` and `seed.ts`.** Routes are in `server/src/routes/`, registered in `routes/index.ts`. OpenAPI for 3.0 routes is in `server/src/openapi.v3.yaml`. Contract tests are in `server/test/*.contract.ts`, and **each new test file must be added to the `test` script in `server/package.json`**.
- **Seed** (`server/src/seed.ts`): keep the existing `rand()` call order. External Playwright suites depend on the seeded data.
- **Front end** (`src/`): React + Vite. Styles per module are in `src/styles/<module>.css`, imported in `src/main.tsx`. v3 tokens are in `src/styles/v3.css`. Each module's logic sits in `src/pages/<module>/` (`*Logic.ts`, `*Bits.tsx`, `*3.test.ts`).
- **Front-end tests** (vitest) often call page components as **plain functions with mocked `useState`/`useEffect`**, relying on hook order. When editing an existing page, keep hook order (add new `useState` calls at the end), avoid lazy `useState` initialisers and functional `setState` in forms, and put stateful extras in sub-components.
- Money is shown in the bank's currency via `money`/`moneyShort` in `src/pages/quotes/quoteLogic.ts`.
- Gotchas found so far:
  - Never name a class `.ghost` (it clashes with `.btn.ghost`).
  - The page-enter animation leaves a transform on `.page`, so use `sticky`, not `fixed`, inside pages.
  - A dragged item that re-renders into another parent loses its handlers, so use window `pointermove`/`pointerup` listeners.
  - `getAll()` returns the store's cached array, so copy it before `setState`.

## 6. Running and checking locally

- Install: `npm install` in the repo root and in `server/`.
- API: `cd server && npx tsx --env-file=.env.local src/index.ts`.
  - It uses PGlite in `.data/pglite` unless `PGLITE_DIR` is set.
  - Set `CORS_ORIGIN` to the front end's address.
  - `.env.local` is gitignored and holds local test sign-ins.
  - Never run two API processes on the same PGlite folder: it damages the folder. The checks so far used `PGLITE_DIR=.data/pglite-tickets` on port 4002 with the front end on 5175 (`VITE_API_BASE_URL=http://localhost:4002`).
- Front end: `npx vite` (set `VITE_API_BASE_URL` to the API).
- Demo sign-ins: the seeded users in `server/src/seed.ts` (Harbor Demo Bank).
- Tests: `npx vitest run` (front end, 404 tests at Search) and `cd server && npm test` (91 tests). Build: `npm run build` in both.
- Design files are viewable through the dev server at `/design/v3/<name>.html`.
- **Do not print secrets.** Credentials live in Render and Neon. The owner types them himself.

## 7. Open items with the owner

- Render checks of Contacts through Search are still to be confirmed by the owner.
- Unanswered question: should the Deals board pin the Won/Lost drop bins and auto-scroll while dragging?
- Data Studio (module 13): wait for the owner's direction.
- Old office notes: the office team, Jira and sprint work are paused and separate from 3.0. 3.0 is built directly, not through the office.
