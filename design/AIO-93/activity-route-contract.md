# Activity view route contract (AIO-122)

Build companion to [AIO-93 Dashboard design](dashboard.html). Screen mockups: [Activity](../AIO-122/activity.html) and [Activity states](../AIO-122/activity-states.html).

## Destination and Dashboard link

- Destination path: `/activity`.
- The Dashboard “view all activity” control is a real, keyboard-reachable link with `href="/activity"` and accessible name “View all activity”.
- The destination provides one `main` landmark, page heading “Activity”, and an ordered list named “Recent activity, latest first”. The Dashboard item remains labelled “Recent activity, scrollable”; do not change its scroll behavior.
- “Back to Dashboard” links to `/dashboard`.

## Content mapping

The full view reuses the existing Recent activity entries verbatim, newest first, with their existing relative time labels:

1. Priya Nair moved “Westfield loan renewal” to Negotiation — 12 min ago.
2. New lead from web form: Calder Logistics — 1 h ago.
3. Ticket #482 closed by Marcus Lee — 3 h ago.
4. Task “Send term sheet” completed — Yesterday.
5. Quote Q-2210 accepted — 2 days ago.

No extra records, dates, filters, pagination behavior, or activity categories are specified. The feed currently scrolls to load more per AIO-93; how additional entries are fetched on the destination is Unknown and should be confirmed against the existing feed implementation before extending it.

## States and accessibility

- Loading: preserve the page heading; mark the activity region `aria-busy="true"` and expose “Loading recent activity” to assistive technology.
- Empty: “No activity yet” with plain next-step guidance; no fabricated sample rows.
- Error: a `role="alert"` message explains the load failed and offers Retry.
- Loaded: ordered list with each relative time adjacent to its activity text. Use semantic `<time>` only when an actual timestamp is available; relative labels alone do not define a datetime.
- Provide a skip link to `main`, visible `:focus-visible` outline, descriptive navigation landmark, and responsive reflow without horizontal scrolling. Maintain keyboard navigation order and 44 px minimum retry target.
- Use the existing Harbor design tokens from `design/DESIGN.md` and `design/design-tokens.json`; bank colour is an accent/fill, never text on a light surface.

## Source evidence and unknowns

Verified sources: AIO-93 `design/AIO-93/dashboard.html` lists the five entries and says “view all activity” is the keyboard route; AIO-113’s staging run confirms the Dashboard feed is focusable and scrollable and confirms the control currently does not navigate. AIO-121 records that `/activity` has no destination in the current app. The authenticated staging screen itself was not inspected for this design task; the five entries above come from the AIO-93 design artifact.
