# AIO-320 build brief (Tickets and SLA)

Action item from design review #92. Build from these files; do not copy tiles between them.

## Sources of truth
- Layouts, copy and most states: `design/AIO-320/*.html` (six screens).
- Load, empty, error and Retry-in-progress states for board, record, edit, new-ticket requester and SLA settings: `design/AIO-348/ticket-states-gaps.html` (authoritative; `design/AIO-327/ticket-states.html` t4b links to it). Its links to `../AIO-327/...` are for the older copies of the inbox; the AIO-320 files win where they differ.
- `design/AIO-382/ticket-states-gaps.html` also exists on release; it was not reviewed for this brief.

## Confirmed in the mockups (read from source, not from browser renders)
- Board keyboard alternative to drag: `design/AIO-320/tickets-board.html` line 26, a per-card button with `aria-haspopup="menu"` and `aria-label="Set priority for <subject>"`, opening a four-item menu; line 40 states the rule. The board columns are priorities, so the menu is "Set priority", not "Move to". Use that wording.
- Phone tap target: same file, `.move` is 36 px on desktop (line 14) and 44 px at phone width (line 18). Other controls use `min-height:44px`.
- Retry: load failures have a Retry button in `design/AIO-348/ticket-states-gaps.html` (board, record, edit, requester, SLA) and in `design/AIO-320/sla-settings.html:28` and `ticket-states.html:27`. "Not found" has no Retry by design (link back to the list).

## Gaps for Alex to decide, not drawn as Retry
- Mutation failures in `ticket-states.html` for comment add, delete and SLA save keep the typed input and the dialog open; the primary button is the retry. Status and priority failures have "Try again". If you want a named Retry on the comment, delete and SLA tiles, ask Iris for a revision.
- `/contacts/new` in the requester-empty tile is unverified.
- Rep SLA edit stays read-only for non-admins (provisional, AIO-185 question #181 open).
- Accessibility from review #92: a live region for SLA time updated at most once a minute; disabled viewer controls need visible text or `aria-describedby`.
