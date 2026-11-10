# Tasks recovery design
Scope: [AIO-299](https://ai-agent-office.atlassian.net/browse/AIO-299), separated by AIO-292 review #52 from [AIO-283](https://ai-agent-office.atlassian.net/browse/AIO-283). Requirements: AIO-162, Epic AIO-161. Morgan must create the follow-up implementation Story; its key is Unknown.

## Design plan and brief review
Bankers (admin and rep) need confidence that their daily task order was saved. Viewers need reliable read-only loading and recovery.
Palette: Harbor navy #1d3a6e, paper #ffffff, workspace #f4f6f8, ink #1f2937, muted ink #5b6472, error ink #991b1b. Existing root tokens from src/styles.css; design/design-tokens.json has an older muted value, so the source-of-truth CSS wins. No shared token changes.
Type: existing Inter Variable/system stack; page 24/32 700, section 18/24 600, body 14/20, supporting text 13/20.
Layout: left aligned, one task surface per state, 32 px desktop and 16 px phone gutters. Compare:
```
A: rail | heading / filters / task rows / status
B: rail | task cards in columns / floating recovery toast
```
Choose A: order is meaningful only as one list; B hides rollback context. One memorable element: position marker during reorder feedback. Retain the smoked navigation and disciplined surfaces from the established CRM. Review revision: remove extra glass decoration from recovery panels; status and next action carry the hierarchy. No new font, palette or dashboard KPIs.
These are static state sheets, not functioning application pages. Build contracts are annotations, not product content. No scripts or external images. Sample-bank coverage remains in AIO-283.

## Coverage
- tasks-loading.html: six skeleton rows; load-error alert and Retry; pending Retry; draft/filter retention, timeout and stale-result handling. Empty success reuses AIO-292 per-filter states.
- tasks-reorder.html: optimistic move; disabled filters while saving; rejected-save rollback; stable keyboard focus; success and failure announcement copy; All-only and role rules.
- AC15: reorder rollback only; other mutation rollback remains excluded by review #51.
- AC16/20/24/26/27: keyboard move, loading, focus and announcement contracts.
- AC21/22/23: phone, below-780 overlay shell and desktop. Existing API and test IDs retained; no runtime code changed.
- Native alert/confirm, validation and other full rows remain AIO-283/AIO-292.

## Verification and limitations
Read release b79f89f: src/pages/Tasks.tsx, src/components/Spinner.tsx, src/styles.css, design/DESIGN.md, design/design-tokens.json, design/AIO-283/tasks.html. Six requested skeleton rows and no catch in load/onDrop verified in Tasks.tsx. Approved knowledge used: #810 (role and Tasks criteria), #98 (failure must exit loading into Retry).
Staging navigation reached /login, title Practice CRM, showing Harbor CRM and the sign-in form. Sign-in was not attempted: repo_read returned "Error: README.md is outside your permitted repository read paths". Authenticated Tasks appearance Unknown.
Browser layout checks on both mockup documents: 1440, 1024, 768, 390 and 375 px; document scrollWidth equals viewport at all widths. At 768 and smaller, sidebar hidden and menu visible. All rendered move buttons are at least 44x44 px. Shell overlay operation is inherited from AIO-140, not implemented or tested here.
Inspected all four initial PNGs for hierarchy, spacing, alignment, type, phone overflow, focus and token consistency. Fixed desktop header spacing, moved initial status outside aria-busy, and aligned pending move markup with the aria-disabled contract. No motion is needed; reduced-motion CSS is present. Removed duplicate decoration; one elevation per state.
Contrast calculations recorded in PR. Screen-reader announcements, API races, timeout/reconciliation and actual rollback are design specifications, not runtime-tested behavior.
Self-scores after revision: accuracy 4/5, completeness 4/5, clarity 4/5, polish 4/5. No score at 3 or below.
Failure during draft orchestration: "TypeError: load is not a function"; corrected variable shadowing before any write succeeded. No build/test command available or run; HTML design only.
