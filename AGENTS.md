# Agent instructions

This repo holds Harbor CRM. The current work is **CRM 3.0** on the `v3` branch.

Before doing anything, read:
1. `docs/v3/HANDOFF.md`: where the work stands, the owner's rules, what to build next, how the code is organised, and how to run and test it.
2. `docs/v3/PLAN.md`: the full CRM 3.0 plan the owner approved.
3. The approved design for the module you are building, in `design/v3/` (open the HTML in a browser; it is interactive and is the spec).

Short version of the rules:
- Work on branches cut from `v3`. Open PRs into `v3`. The owner merges. Never touch `release` or `main`.
- Design first and get the owner's approval before building a new module. Module 12 (Setup + Customise page layout) is already approved.
- Keep existing `data-testid`s, keep the seed's random order, add new collections and contract tests where the handoff says.
- Test every control in the browser (desktop, phone width, dark mode) and run both test suites before saying it works.
- Never print or commit secrets.
