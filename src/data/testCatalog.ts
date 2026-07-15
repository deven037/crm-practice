// AUTO-GENERATED test case catalog — the executable specification of this application.
// Read-only documentation for anyone automating against Practice CRM.

export interface CatalogCase {
  id: string;
  title: string;
  tags: string[];
  steps: [string, string][]; // [action, expected result]
}

export interface CatalogModule {
  name: string;
  cases: CatalogCase[];
}

export const CATALOG_INTRO = "Application at deterministic seed state (open with /?reset=true). Password for all users: Pass@123. Default login: admin@crm.com unless stated. Seed: 50 leads, 40 contacts, 20 accounts, 12 products, 25 deals, 30 tasks, 15 tickets, 5 users. All data operations have simulated latency (300–1200 ms) — wait for spinners/skeletons to resolve before asserting.";

export const TEST_CATALOG: CatalogModule[] = [
  {
    "name": "Authentication",
    "cases": [
      {
        "id": "TC-AUTH-001",
        "title": "Login happy path: guard redirect, sign-in, session, logout",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "While logged out, open /deals directly",
            "Redirected to /login (route guard)"
          ],
          [
            "Enter admin@crm.com / Pass@123 with \"Remember me\" checked",
            "Fields accept values"
          ],
          [
            "Click Sign in",
            "Button shows \"Signing in…\" and disables during latency"
          ],
          [
            "Wait for navigation",
            "Lands on /deals — the original deep link is restored, not the dashboard"
          ],
          [
            "Navigate to Dashboard",
            "Welcome toast appears once and auto-dismisses (~4.5 s)"
          ],
          [
            "Reload the browser",
            "Still logged in (persistent session)"
          ],
          [
            "Open the avatar menu → Log out",
            "Returned to the login page"
          ],
          [
            "Open /leads directly, then press browser Back",
            "Guard redirects both attempts; no protected content shown"
          ]
        ]
      },
      {
        "id": "TC-AUTH-002",
        "title": "Login negative matrix: wrong password, unknown user, deactivated account, field validation, show/hide",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click Sign in with both fields empty",
            "Field errors: \"Email is required.\" and \"Password is required.\"; no banner"
          ],
          [
            "Enter \"notanemail\" + any password; Sign in",
            "\"Enter a valid email address.\" under the email field"
          ],
          [
            "Enter admin@crm.com / Wrong@123; Sign in",
            "Red banner \"Invalid email or password.\"; values preserved; stays on login"
          ],
          [
            "Enter ghost@crm.com / Pass@123; Sign in",
            "Same generic banner (no user-enumeration hint)"
          ],
          [
            "Enter priya@crm.com / Pass@123; Sign in",
            "Specific banner: \"This account has been deactivated. Contact your administrator.\""
          ],
          [
            "Type a password and click the eye toggle twice",
            "Input type flips password→text→password; value preserved"
          ],
          [
            "Verify no session leaked from the failed attempts by opening /admin",
            "Redirected to login"
          ],
          [
            "Log in correctly as admin",
            "Dashboard loads — form recovers cleanly after all failures"
          ]
        ]
      },
      {
        "id": "TC-AUTH-003",
        "title": "Session persistence matrix: Remember me ON vs OFF across browser restarts",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Log in with \"Remember me\" CHECKED",
            "Dashboard loads"
          ],
          [
            "Close the entire browser (not just the tab); reopen the app URL",
            "Still logged in — session survived (localStorage)"
          ],
          [
            "Log out; log in with \"Remember me\" UNCHECKED",
            "Dashboard loads"
          ],
          [
            "Reload the page",
            "Still logged in (same tab session)"
          ],
          [
            "Close the browser fully; reopen the app",
            "Back at the login page — session was sessionStorage-only"
          ],
          [
            "Open /tickets while logged out",
            "Redirect to login"
          ],
          [
            "Log in",
            "Lands on /tickets (deep link restored after the restart cycle too)"
          ]
        ]
      },
      {
        "id": "TC-AUTH-004",
        "title": "Forgot-password: full 3-step reset with every negative branch",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"Forgot password?\"; enter \"abc\"; Send reset code",
            "\"Enter a valid email address.\"; stays on step 1"
          ],
          [
            "Enter rep@crm.com; Send reset code",
            "Info toast confirms the code was \"sent\" (hint: 123456); step 2 of 3 shown"
          ],
          [
            "Enter 000000; Verify code",
            "\"Incorrect code. Try again.\"; stays on step 2"
          ],
          [
            "Enter 123456; Verify code",
            "Step 3 of 3 (new password) shown"
          ],
          [
            "Enter \"short\"; Save password",
            "\"Password must be at least 8 characters.\"; stays on step 3"
          ],
          [
            "Enter NewPass@456; Save password",
            "Success toast; back at Sign in with the email pre-filled"
          ],
          [
            "Log in with the OLD password Pass@123",
            "Rejected with the generic banner"
          ],
          [
            "Log in with NewPass@456",
            "Succeeds; dashboard loads"
          ],
          [
            "Cleanup: open /?reset=true",
            "Seed password restored for subsequent cases"
          ]
        ]
      },
      {
        "id": "TC-AUTH-005",
        "title": "Forgot-password abandonment never changes the password",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Start forgot-password with rep@crm.com; on step 2 click \"Back to sign in\"",
            "Returns to the login form"
          ],
          [
            "Log in as rep with Pass@123",
            "Original password still works (flow abandoned safely)"
          ],
          [
            "Log out; restart the flow; reach step 3; click browser reload",
            "Flow resets to the login card; no partial state"
          ],
          [
            "Log in as rep with Pass@123 again",
            "Original password STILL works"
          ],
          [
            "Restart and complete the full flow with NewPass@789",
            "Only now does the password change"
          ],
          [
            "Verify old fails / new works",
            "Confirmed"
          ],
          [
            "Cleanup via /?reset=true",
            "Seed restored"
          ]
        ]
      },
      {
        "id": "TC-AUTH-006",
        "title": "Feature: email field validation across input shapes",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Submit login with email \"plainaddress\"",
            "Format error shown"
          ],
          [
            "Try \"missing@domain\"",
            "Rejected (no TLD)"
          ],
          [
            "Try \"@nodomain.com\"",
            "Rejected (no local part)"
          ],
          [
            "Try \"spaces in@mail.com\"",
            "Rejected"
          ],
          [
            "Try \"  admin@crm.com  \" (padded)",
            "Trimmed and accepted — login proceeds with the right password"
          ],
          [
            "Try mixed case \"ADMIN@CRM.COM\"",
            "Accepted (case-insensitive match) and logs in"
          ],
          [
            "Verify the error clears when a valid value replaces an invalid one",
            "No stale error text"
          ]
        ]
      },
      {
        "id": "TC-AUTH-007",
        "title": "Feature: sign-in button busy state prevents double submission",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Fill valid credentials; click Sign in once",
            "Button text becomes \"Signing in…\" and the button disables"
          ],
          [
            "Attempt to click it again during the latency window",
            "No second submission (button disabled)"
          ],
          [
            "Wait for completion",
            "Exactly one navigation; one welcome toast"
          ],
          [
            "Log out; fill INVALID credentials; click Sign in",
            "Busy state also shown, then the error banner"
          ],
          [
            "Verify the button re-enables after the failure",
            "Usable for a retry immediately"
          ],
          [
            "Retry with valid credentials",
            "Succeeds — no stuck state"
          ]
        ]
      },
      {
        "id": "TC-AUTH-008",
        "title": "Journey: locked-out rep recovers access and completes a working session",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Arrive at login as a rep who forgot the password: fail twice with guesses",
            "Two error banners; no lockout side effects"
          ],
          [
            "Run forgot-password (wrong code once, then 123456, then a valid new password)",
            "Reset completes; back at login pre-filled"
          ],
          [
            "Log in with the new password",
            "Dashboard loads with welcome toast"
          ],
          [
            "Go to Tasks; complete one due task",
            "Strikethrough + toast (alert handled if overdue)"
          ],
          [
            "Go to Leads; create a lead for a product via the form page",
            "Lands on the lead detail"
          ],
          [
            "Check the dashboard tiles reflect the new lead",
            "\"Total leads\" incremented"
          ],
          [
            "Log out; confirm /leads redirects to login",
            "Session fully closed"
          ],
          [
            "Reset data",
            "Environment clean for the next run"
          ]
        ]
      },
      {
        "id": "TC-AUTH-009",
        "title": "Journey: one browser, four roles — capability tour",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Log in as admin@crm.com",
            "Admin visible in sidebar; Admin page fully editable"
          ],
          [
            "Create a marker record (lead \"RoleTour Lead\")",
            "Created; visible in the list"
          ],
          [
            "Log out; log in as rep@crm.com",
            "Same data visible (shared store); Admin page shows read-only banner with all controls disabled"
          ],
          [
            "Verify rep can edit CRM data: open the marker lead and change its status",
            "Allowed and persisted"
          ],
          [
            "Log out; log in as viewer@crm.com",
            "Admin absent from the sidebar entirely"
          ],
          [
            "Force /admin via URL as viewer",
            "403 Forbidden page with a working \"Back to dashboard\""
          ],
          [
            "Log out; attempt priya@crm.com",
            "Deactivated message — fourth role (blocked) verified"
          ],
          [
            "Log in as admin; delete the marker lead from its detail page",
            "Cleanup done; audit log recorded actions from all sessions in order"
          ]
        ]
      }
    ]
  },
  {
    "name": "Dashboard",
    "cases": [
      {
        "id": "TC-DASH-001",
        "title": "Cold load: skeletons resolve into tiles that reconcile with every module",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Reset data; log in; observe the dashboard while loading",
            "Skeleton bars visible, then replaced by tiles and charts"
          ],
          [
            "Read \"Total leads\"",
            "Exactly 50"
          ],
          [
            "Open Leads and compare",
            "Footer count matches the tile"
          ],
          [
            "Back on Dashboard, read \"Open pipeline\"",
            "A $ amount"
          ],
          [
            "Open Deals; sum the three non-closed column totals",
            "Sum equals the tile value exactly"
          ],
          [
            "Read \"Open tickets\"; open Tickets and count Open + In Progress rows",
            "Counts match"
          ],
          [
            "Read \"Tasks due today\"; open Tasks and count non-completed tasks due today",
            "Counts match"
          ],
          [
            "Return to Dashboard",
            "No console errors; charts all rendered (bar: 5 groups, donut with legend, line: 6 points)"
          ]
        ]
      },
      {
        "id": "TC-DASH-002",
        "title": "Date-range dropdown re-filters charts monotonically",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Note the donut legend counts and the leads-tile hint at \"Last 30 days\"",
            "Baseline recorded"
          ],
          [
            "Switch the range to \"Last 7 days\"",
            "Charts re-render; every count ≤ the 30-day value; hint text updates"
          ],
          [
            "Switch to \"Last 90 days\"",
            "Counts ≥ the 30-day values"
          ],
          [
            "Switch to \"Last year\"",
            "Counts ≥ the 90-day values (monotonic growth with range)"
          ],
          [
            "Verify the donut legend sums",
            "Legend total = non-converted leads within the selected range"
          ],
          [
            "Verify the bar chart",
            "Still 5 stage groups; values change with range"
          ],
          [
            "Switch back to \"Last 30 days\"",
            "Original baseline values return (deterministic)"
          ]
        ]
      },
      {
        "id": "TC-DASH-003",
        "title": "Activity feed: infinite scroll to exhaustion with stable batches",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Locate the Recent activity feed",
            "Initial batch (~12 items) rendered"
          ],
          [
            "Scroll the feed container to its bottom",
            "\"Loading more…\" appears, then the next batch"
          ],
          [
            "Count items after the batch",
            "Previous count + ~12; no duplicates"
          ],
          [
            "Repeat until the end",
            "\"You’re all caught up 🎉\" shown at exactly 60 items"
          ],
          [
            "Scroll up and back down",
            "No re-loading loop; end message stable"
          ],
          [
            "Navigate away to Leads and back to Dashboard",
            "Feed resets to the first batch and scrolls again correctly"
          ],
          [
            "Watch the welcome toast on this return",
            "None — it fires only once per session"
          ]
        ]
      },
      {
        "id": "TC-DASH-004",
        "title": "Dashboard reflects live data changes from other modules",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Record \"Open pipeline\" (P) and \"Total leads\" (L)",
            "Baseline captured"
          ],
          [
            "Create a deal of $50,000 in Qualification; return to Dashboard",
            "Open pipeline = P + $50,000"
          ],
          [
            "Create a lead via the Leads form; return",
            "Total leads = L + 1; range hint updates"
          ],
          [
            "Move the new deal to Closed Won; return",
            "Open pipeline back to P; won-revenue line chart current-month point increased"
          ],
          [
            "Complete a task due today; return",
            "\"Tasks due today\" decremented"
          ],
          [
            "Create an Urgent ticket; return",
            "\"Open tickets\" incremented"
          ],
          [
            "Reset data; log in; recheck all tiles",
            "All values back to the deterministic seed baseline"
          ]
        ]
      },
      {
        "id": "TC-DASH-005",
        "title": "Feature: \"Open pipeline\" tile computes only non-closed stages",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Reset; record the tile value P",
            "Baseline"
          ],
          [
            "Create a deal of $40k in Qualification; recheck",
            "P + 40,000"
          ],
          [
            "Move it to Negotiation; recheck",
            "Still P + 40,000 (open stage moves do not change the sum)"
          ],
          [
            "Move it to Closed Won; recheck",
            "Back to P (won is excluded)"
          ],
          [
            "Create a $10k deal directly in Closed Lost (via form stage select); recheck",
            "Still P (lost is excluded)"
          ],
          [
            "Delete both test deals",
            "Tile returns exactly to P"
          ],
          [
            "Compare against the Deals board open-column totals",
            "Tile = sum of the three open columns, always"
          ]
        ]
      },
      {
        "id": "TC-DASH-006",
        "title": "Feature: donut chart legend matches the filtered lead statuses",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "At range \"Last year\", read the four legend entries",
            "New/Contacted/Qualified/Unqualified counts shown"
          ],
          [
            "Sum them",
            "Equals leads created in range, excluding Converted"
          ],
          [
            "Cross-check one status count against the Leads page filter",
            "Exact match"
          ],
          [
            "Convert a lead; return",
            "That status segment decremented (Converted excluded from the donut)"
          ],
          [
            "Create a new lead; return",
            "\"New\" segment incremented"
          ],
          [
            "Narrow the range to 7 days",
            "Legend recalculates; only recent creations counted"
          ]
        ]
      },
      {
        "id": "TC-DASH-007",
        "title": "Journey: sales manager’s Monday-morning triage driven from the dashboard",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Log in as admin; set range \"Last 7 days\"",
            "Tiles + charts show the week"
          ],
          [
            "From the donut, identify the biggest lead-status segment; open Leads and filter to that status",
            "List count matches the segment count"
          ],
          [
            "Sort those leads by Value desc; bulk-select the top 3; assign to Riya Rep",
            "Toast; owner column updates"
          ],
          [
            "Return to Dashboard; open the activity feed and scroll two batches",
            "Weekend activity readable"
          ],
          [
            "From \"Open tickets\", open Tickets; filter chip Open; open the oldest",
            "Ticket detail with SLA state"
          ],
          [
            "Escalate: priority → Urgent; add a canned comment",
            "Persisted; toast"
          ],
          [
            "Back to Dashboard; verify \"Open pipeline\" against the Deals board totals",
            "Numbers reconcile"
          ],
          [
            "Log out",
            "Week planned: assignments made, risk escalated, numbers verified"
          ]
        ]
      },
      {
        "id": "TC-DASH-008",
        "title": "Journey: dashboard truth after heavy data churn",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Reset; log in; snapshot all four tiles",
            "Deterministic baseline"
          ],
          [
            "Churn: create 2 leads, convert 1 (with a $30k deal), create a product, complete 2 tasks, close 1 ticket",
            "Each action toasts and lands correctly"
          ],
          [
            "Return to Dashboard",
            "Total leads = baseline + 2; open pipeline = baseline + $30,000"
          ],
          [
            "Move the new deal to Closed Won",
            "Pipeline returns to baseline; won revenue grows"
          ],
          [
            "Check \"Tasks due today\" and \"Open tickets\"",
            "Reflect the completions/closure exactly"
          ],
          [
            "Switch ranges 7d → 1y",
            "New records appear in wider ranges consistently"
          ],
          [
            "Reset data; recheck",
            "All tiles exactly back to the seed snapshot — no residue"
          ]
        ]
      }
    ]
  },
  {
    "name": "Leads",
    "cases": [
      {
        "id": "TC-LEAD-001",
        "title": "Create a lead via the form page: validation, product select, detail landing",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Lead\"",
            "Navigates to /leads/new; breadcrumb Leads / New lead"
          ],
          [
            "Click Create lead with the form empty",
            "Errors under Full name and Email; no navigation"
          ],
          [
            "Enter name Vikram Joshi and email \"vikram@\"; Create",
            "Only the email error remains: \"Enter a valid email.\""
          ],
          [
            "Fix the email; add company Meridian Soft and a phone",
            "Accepted"
          ],
          [
            "Open Status; select Contacted",
            "Custom dropdown selects and closes"
          ],
          [
            "Open Interested product; type \"Enter\"; pick CRM Enterprise Plan",
            "Options filter live while typing"
          ],
          [
            "Set value 55000; click Create lead",
            "\"Creating…\" busy state during save"
          ],
          [
            "Verify the landing page",
            "Lead DETAIL page (/leads/lead-…), not the list; toast; pill Contacted; product is a link"
          ],
          [
            "Breadcrumb to Leads; search Vikram",
            "New lead present with every entered value"
          ]
        ]
      },
      {
        "id": "TC-LEAD-002",
        "title": "Table mechanics: sorting both directions, debounced search, pagination bounds",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Verify the default table state",
            "10 rows; \"50 lead(s) · page 1 of 5\"; Prev disabled"
          ],
          [
            "Click the Value header, then again",
            "▲ ascending then ▼ descending; row order verifiably reverses"
          ],
          [
            "Click the Name header",
            "Sort switches to Name ▲; Value indicator cleared"
          ],
          [
            "Type \"sharma\" and observe within 300 ms",
            "No filtering yet (debounce)"
          ],
          [
            "Wait for the debounce to fire",
            "Only matching rows; footer count drops; page resets to 1"
          ],
          [
            "Clear the search; set page size 25",
            "50 rows across 2 pages"
          ],
          [
            "Click Next ›, then the page-1 number button",
            "Next/Prev disable correctly at each boundary"
          ],
          [
            "Search \"zzzqqq\"",
            "Empty-state row \"No leads match the current filters.\""
          ],
          [
            "Clear; verify recovery",
            "Full 50 rows return with sort preserved"
          ]
        ]
      },
      {
        "id": "TC-LEAD-003",
        "title": "Filter panel: combining status, source, owner, and clearing",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open Filters",
            "Panel with Status multi-select, Source, Owner"
          ],
          [
            "Tick statuses New + Contacted",
            "Chips render in the trigger; table narrowed; count drops"
          ],
          [
            "Add Source = Web",
            "Rows satisfy status AND source"
          ],
          [
            "Add Owner = Riya Rep",
            "Rows satisfy all three"
          ],
          [
            "Verify the Filters button",
            "Active dot (•) shown"
          ],
          [
            "Remove the New chip via its ×",
            "Re-filters to Contacted-only without opening the menu"
          ],
          [
            "Type a search term on top",
            "Search ANDs with the filters"
          ],
          [
            "Click Clear filters; clear the search",
            "Panel resets, then full list returns"
          ]
        ]
      },
      {
        "id": "TC-LEAD-004",
        "title": "Row navigation: any cell opens detail, checkbox is exempt, double-click has no editor",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Hover a lead row",
            "Pointer cursor / hover styling"
          ],
          [
            "Click the row on the Name cell",
            "Detail page opens; breadcrumb Leads / {name}"
          ],
          [
            "Back; click the same row on the Email cell, then on the Value cell",
            "Both clicks navigate to the same detail"
          ],
          [
            "Double-click the Email cell",
            "NO inline editor appears (removed feature); navigates like a click"
          ],
          [
            "Back on the list, click a row checkbox",
            "Row selects, bulk bar appears, NO navigation"
          ],
          [
            "Untick; click the row body",
            "Detail opens again"
          ],
          [
            "Edit the URL id to lead-doesnotexist",
            "\"Lead not found.\" with a working back link"
          ]
        ]
      },
      {
        "id": "TC-LEAD-005",
        "title": "Context menu: exactly two actions with correct open/close semantics",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Right-click a lead row",
            "Menu at cursor with exactly: 👁 View details, 🔄 Convert lead… (no Edit/Delete)"
          ],
          [
            "Click elsewhere on the page",
            "Menu closes without action"
          ],
          [
            "Right-click again; press Escape",
            "Menu closes"
          ],
          [
            "Right-click row A, then row B without closing",
            "Only B’s menu remains open"
          ],
          [
            "Choose View details",
            "Detail page for that exact row’s lead"
          ],
          [
            "Back; right-click → Convert lead…",
            "Wizard modal opens at step 1"
          ],
          [
            "Escape the wizard",
            "Closed; lead unchanged; no partial records"
          ]
        ]
      },
      {
        "id": "TC-LEAD-006",
        "title": "Bulk operations: selection across pages, assign owner, bulk delete with confirm",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Tick 3 checkboxes",
            "Bulk bar \"3 selected\""
          ],
          [
            "Tick header select-all",
            "All 10 page rows selected; count correct"
          ],
          [
            "Go to page 2 and back",
            "Selection preserved"
          ],
          [
            "Click Assign owner",
            "Modal; Assign disabled until a choice"
          ],
          [
            "Pick Sam Sales; Assign",
            "Toast; owner column updates; bar clears"
          ],
          [
            "Select all on page 1 again; click Delete; CANCEL the confirm",
            "Nothing deleted"
          ],
          [
            "Delete again; ACCEPT",
            "Toast \"10 lead(s) deleted.\"; footer 40; pagination recalculated"
          ],
          [
            "Reload; search a deleted name",
            "Persisted; \"No leads match\""
          ]
        ]
      },
      {
        "id": "TC-LEAD-007",
        "title": "Convert wizard: both account branches, deal option, and gating",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Convert a Qualified lead; verify step 1",
            "Contact fields pre-filled from the lead"
          ],
          [
            "Edit the phone; Next; then Back",
            "Edit preserved across steps"
          ],
          [
            "Branch A: keep \"Create new account\"; Next; skip deal; Finish",
            "Lead → Converted; new account + contact (tag imported) created; NO deal"
          ],
          [
            "Convert a second lead; step 2: choose \"Link existing account\"",
            "Next DISABLED until selection"
          ],
          [
            "Type \"xyz123\"",
            "\"No matches found\""
          ],
          [
            "Pick Silverline Bank; Next; tick \"Also create a deal\", amount 65000; Finish",
            "Contact linked to Silverline; deal $65,000 in Qualification; no new account"
          ],
          [
            "Start the wizard on a third lead; Escape at step 3",
            "No partial records anywhere; lead unchanged"
          ],
          [
            "Audit log",
            "lead.convert entries recorded for both conversions"
          ]
        ]
      },
      {
        "id": "TC-LEAD-008",
        "title": "Detail page: edit with validation, cancel semantics, persistence, delete variants",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a lead detail; click Edit",
            "In-place form; Save/Cancel replace Edit/Delete"
          ],
          [
            "Change value/owner/status; Cancel",
            "Original values restored"
          ],
          [
            "Edit; clear the name; Save",
            "Error toast; stays in edit mode"
          ],
          [
            "Fix name; set email \"bad@\"; Save",
            "Same validation error"
          ],
          [
            "Fix email; Save; reload the URL",
            "Toast; all changes persisted; header pill updated"
          ],
          [
            "Click Delete on this (non-converted) lead; Cancel",
            "Plain confirm modal; lead intact"
          ],
          [
            "Delete and confirm",
            "Toast; back on /leads; row gone"
          ],
          [
            "Open a Converted lead; Delete",
            "Extra banner: conversion records will NOT be deleted"
          ],
          [
            "Confirm; check Contacts/Accounts",
            "Lead gone; conversion records survive"
          ]
        ]
      },
      {
        "id": "TC-LEAD-009",
        "title": "CSV export mirrors the filtered view and escapes special characters",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "With no filters, click Export CSV",
            "leads-export.csv downloads; toast \"Exported 50 leads to CSV.\""
          ],
          [
            "Open the file",
            "Header + 50 rows; owner as a name; values match the table"
          ],
          [
            "Filter Status = Qualified (note count n); export",
            "Exactly n data rows, all Qualified"
          ],
          [
            "Search to zero results; export",
            "Header row only; toast \"Exported 0 leads\""
          ],
          [
            "Via detail edit set a company to \"Acme, Inc\"; export",
            "Comma cell is quoted; columns aligned"
          ],
          [
            "Set a company containing a double quote; export",
            "Quote escaped as \"\"; file parses cleanly"
          ],
          [
            "Clear filters; export once more",
            "Row count matches current list state"
          ]
        ]
      },
      {
        "id": "TC-LEAD-010",
        "title": "Feature: search debounce — timing, scope, and case handling",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Type \"sha\" quickly and watch the table for 300 ms",
            "No filtering during the debounce window"
          ],
          [
            "Stop typing; wait",
            "Filter applies once, ~350 ms after the last keystroke"
          ],
          [
            "Continue typing to \"sharma\" without pausing",
            "Only one final filtering, not one per keystroke"
          ],
          [
            "Verify case-insensitivity with \"SHARMA\"",
            "Same results"
          ],
          [
            "Search an email fragment \"@example\"",
            "Matches on the email field too"
          ],
          [
            "Search a company fragment",
            "Matches on company — search spans name, company, and email"
          ],
          [
            "Clear the field rapidly mid-debounce",
            "No ghost filter fires afterwards; full list stays"
          ]
        ]
      },
      {
        "id": "TC-LEAD-011",
        "title": "Feature: pagination — sizes, boundaries, and interaction with filters",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Default state",
            "Size 10; \"page 1 of 5\"; Prev disabled"
          ],
          [
            "Navigate to the last page",
            "Next disabled; remaining rows shown"
          ],
          [
            "Switch size to 50",
            "Single page; both nav buttons disabled"
          ],
          [
            "Switch to 25; go to page 2; apply a status filter",
            "Page resets to 1 (filters reset pagination)"
          ],
          [
            "Clear the filter",
            "Count restored; still on page 1"
          ],
          [
            "Type a search that leaves < 10 results",
            "Pagination shows \"page 1 of 1\""
          ],
          [
            "Verify the footer count text at each step",
            "Always \"N lead(s) · page X of Y\" and accurate"
          ]
        ]
      },
      {
        "id": "TC-LEAD-012",
        "title": "Feature: select-all checkbox semantics",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Tick the header checkbox on page 1",
            "All 10 page rows selected; bulk bar count = 10"
          ],
          [
            "Untick one row",
            "Header checkbox unchecks (no longer \"all\")"
          ],
          [
            "Re-tick the row; untick the header",
            "All page rows deselect"
          ],
          [
            "Select 2 rows on page 1; go to page 2; tick header there",
            "Bulk bar = 12 (selection accumulates across pages)"
          ],
          [
            "Return to page 1",
            "The original 2 still ticked"
          ],
          [
            "Perform a bulk action",
            "Applies to all 12, then clears the whole selection"
          ]
        ]
      },
      {
        "id": "TC-LEAD-013",
        "title": "Feature: sort matrix — every sortable column, both directions",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Click Name; verify ascending; click again",
            "A→Z then Z→A, verified on first/last rows"
          ],
          [
            "Click Company both directions",
            "Alphabetical order flips correctly"
          ],
          [
            "Click Status both directions",
            "Rows grouped by status text order"
          ],
          [
            "Click Source both directions",
            "Same correctness"
          ],
          [
            "Click Value both directions",
            "Numeric (not lexicographic — 9,000 sorts below 80,000)"
          ],
          [
            "Click Created both directions",
            "Chronological order flips"
          ],
          [
            "Verify only ONE column shows an indicator at a time",
            "Previous indicator clears when a new column is sorted"
          ],
          [
            "Sort + filter + search combined",
            "Sort applies to the filtered subset"
          ]
        ]
      },
      {
        "id": "TC-LEAD-014",
        "title": "Feature: lead status pill rendering for every status",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Filter status New",
            "Blue \"New\" pills only"
          ],
          [
            "Filter Contacted",
            "Amber pills"
          ],
          [
            "Filter Qualified",
            "Green pills"
          ],
          [
            "Filter Unqualified",
            "Grey pills"
          ],
          [
            "Convert a lead and locate it",
            "Purple \"Converted\" pill"
          ],
          [
            "Open each variant’s detail page",
            "Header pill matches the list pill in text and color class"
          ],
          [
            "Switch to dark theme",
            "All five pill variants remain legible"
          ]
        ]
      },
      {
        "id": "TC-LEAD-015",
        "title": "Journey: lead lifecycle from web inquiry to audited deletion",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create a lead via the form (validation exercised, product attached)",
            "Detail landing with product link"
          ],
          [
            "Find it via search, then via status filter, then via sort by Created",
            "Locatable through every table mechanism"
          ],
          [
            "Open detail; progress status New → Contacted → Qualified over two edits",
            "Pill updates each time; persists on reload"
          ],
          [
            "Right-click → Convert: existing account + $65k deal",
            "Wizard gates respected; pill Converted"
          ],
          [
            "Verify the contact, the deal on the kanban, and the product’s \"Leads generated\" panel",
            "All three linked correctly"
          ],
          [
            "Delete the lead from its detail",
            "Converted warning; conversion records survive"
          ],
          [
            "Export CSV",
            "Reflects the post-deletion list"
          ],
          [
            "Admin → Audit log",
            "create, saves, convert, delete — all recorded in order"
          ]
        ]
      },
      {
        "id": "TC-LEAD-016",
        "title": "Journey: bulk pipeline hygiene for a messy quarter",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create 3 junk leads quickly via the form",
            "Each lands on detail; return via breadcrumb each time"
          ],
          [
            "Filter status New + sort by Created desc",
            "The 3 junk leads at the top"
          ],
          [
            "Bulk-select them + 2 seed leads; assign all to Sam Sales",
            "Owner column updates on 5 rows"
          ],
          [
            "Re-filter Owner = Sam Sales",
            "All 5 present"
          ],
          [
            "Select the 3 junk leads; bulk delete; cancel first, then accept",
            "Dialog honoured; 3 removed; counts correct"
          ],
          [
            "Set one remaining lead to Unqualified via detail edit",
            "Pill updates"
          ],
          [
            "Filter Unqualified; export CSV",
            "File contains exactly the unqualified set"
          ],
          [
            "Clear filters; verify footer count",
            "Seed 50 + 0 junk − 3 deleted math holds"
          ]
        ]
      },
      {
        "id": "TC-LEAD-017",
        "title": "Journey: product-driven lead chase from catalog to pipeline",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Open Products; pick CRM Professional Plan; \"+ New lead for this product\"",
            "Lead form pre-filled with the product"
          ],
          [
            "Create the lead ($80,000 value)",
            "Detail landing; product links back"
          ],
          [
            "From the product detail verify \"Leads generated\" grew",
            "New lead listed with New pill"
          ],
          [
            "Work the lead: Contacted, then Qualified (detail edits)",
            "Pills update"
          ],
          [
            "Convert with existing account + $80k deal",
            "Deal appears in Qualification"
          ],
          [
            "Drag the deal to Proposal, then Negotiation",
            "Totals shift correctly each time"
          ],
          [
            "Product detail again",
            "The (now Converted) lead still attributed to the product"
          ],
          [
            "Dashboard",
            "Pipeline reflects the $80k at its current stage"
          ]
        ]
      }
    ]
  },
  {
    "name": "Products",
    "cases": [
      {
        "id": "TC-PROD-001",
        "title": "Create a product: validation, auto-SKU, active flag, detail landing",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Product\"",
            "/products/new; breadcrumb Products / New product"
          ],
          [
            "Click Create product empty",
            "Errors: name required; \"Enter a valid price greater than 0.\""
          ],
          [
            "Enter name Test Gadget; price \"abc\"; Create",
            "Price error persists"
          ],
          [
            "Price \"0\"; Create",
            "Still rejected (must be > 0)"
          ],
          [
            "Price 9999; SKU left blank; category Training via dropdown; description text; Active ON",
            "Accepted"
          ],
          [
            "Click Create product",
            "\"Creating…\" busy state, then lands on the product DETAIL page"
          ],
          [
            "Inspect the detail",
            "Auto-generated SKU (PRD-…); Active pill; \"Leads generated (0)\" panel"
          ],
          [
            "Breadcrumb to Products",
            "Test Gadget is row 1 (newest first)"
          ]
        ]
      },
      {
        "id": "TC-PROD-002",
        "title": "List behaviors: recency ordering, three-field search, empty state, row navigation",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open Products on fresh seed",
            "12 rows ordered newest → oldest by Created"
          ],
          [
            "Create a product and return to the list",
            "It occupies row 1 — ordering is live"
          ],
          [
            "Search \"PRD-003\"",
            "Exactly CRM Enterprise Plan (SKU match)"
          ],
          [
            "Clear; search \"Service\"",
            "Only Service-category products (category match)"
          ],
          [
            "Clear; search \"migration\"",
            "Data Migration Service (name match)"
          ],
          [
            "Search gibberish",
            "\"No products match\" empty state"
          ],
          [
            "Clear; click any row",
            "That product’s detail page opens"
          ],
          [
            "Verify Inactive products display",
            "Grey \"Inactive\" pill on the seeded inactive item"
          ]
        ]
      },
      {
        "id": "TC-PROD-003",
        "title": "Detail edit: full round-trip including active toggle propagation",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a product; click Edit",
            "In-place form: name, category, price, active switch, description"
          ],
          [
            "Change category and price; toggle Inactive; Cancel",
            "Read view shows ORIGINAL values"
          ],
          [
            "Edit again; same changes; Save",
            "Toast; read view updated; header pill flips to Inactive"
          ],
          [
            "Back on the list",
            "Row shows the Inactive pill and new price"
          ],
          [
            "Edit; clear the name; Save",
            "Error toast \"Product name is required.\""
          ],
          [
            "Restore the name; Save; reload the detail URL",
            "All changes persisted"
          ],
          [
            "Open the lead form and check the product dropdown",
            "The product still appears (inactive ≠ deleted)"
          ]
        ]
      },
      {
        "id": "TC-PROD-004",
        "title": "Product-to-lead attribution: prefill button and live panel",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a product with no leads",
            "\"Leads generated (0)\" with empty-state text"
          ],
          [
            "Click \"+ New lead for this product\"",
            "Lead form at /leads/new?productId=…; Interested product PRE-FILLED"
          ],
          [
            "Create the lead",
            "Lands on the lead detail; product rendered as a link"
          ],
          [
            "Click the product link",
            "Back on the product; panel now \"Leads generated (1)\" with status pill"
          ],
          [
            "Create a second lead the same way",
            "Panel shows (2); both listed"
          ],
          [
            "Click a lead name in the panel",
            "Navigates to that lead’s detail"
          ],
          [
            "Change that lead’s product to \"No product\" via edit; return to the product",
            "Panel back to (1) — attribution is live"
          ]
        ]
      },
      {
        "id": "TC-PROD-005",
        "title": "Delete matrix: simple confirm without leads, type-name gate with leads, unlink verification",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Create a throwaway product; open detail; Delete",
            "Simple confirm modal — no type-to-confirm input"
          ],
          [
            "Cancel, then Delete and confirm",
            "Toast; back on the list; product gone"
          ],
          [
            "Open a product that HAS linked leads; Delete",
            "Red warning \"N lead(s) reference this product…\"; name input; Delete button DISABLED"
          ],
          [
            "Type a wrong name",
            "Still disabled"
          ],
          [
            "Type the exact product name",
            "Delete enables"
          ],
          [
            "Confirm",
            "Toast mentions unlinking; navigated to /products"
          ],
          [
            "Open one affected lead",
            "Interested product shows \"—\"; lead intact"
          ],
          [
            "Open the lead-form product dropdown",
            "Deleted product absent from the options"
          ]
        ]
      },
      {
        "id": "TC-PROD-006",
        "title": "Feature: SKU auto-generation and custom override",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Create a product named \"Alpha Beta Gamma\" with SKU left blank",
            "SKU auto-generates containing the initials pattern (PRD-ABG-…)"
          ],
          [
            "Create another with the same name, SKU blank",
            "A different SKU (time-based suffix) — no duplicates"
          ],
          [
            "Create one with custom SKU \"MY-SKU-01\"",
            "Kept exactly as typed"
          ],
          [
            "Verify all three on the list",
            "SKUs rendered in code style"
          ],
          [
            "Search \"MY-SKU-01\"",
            "Custom SKU searchable"
          ],
          [
            "Edit a product — SKU display",
            "SKU shown as read-only on the detail (not editable after creation)"
          ],
          [
            "Cleanup: delete the three test products",
            "Simple confirms (no leads attached)"
          ]
        ]
      },
      {
        "id": "TC-PROD-007",
        "title": "Feature: price validation and currency display",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Attempt creation with price empty",
            "Rejected"
          ],
          [
            "Price \"abc\"",
            "Rejected"
          ],
          [
            "Price \"0\"",
            "Rejected (must be > 0)"
          ],
          [
            "Price \"12,500\" (with comma)",
            "Accepted — non-numeric characters stripped; stored as 12500"
          ],
          [
            "Verify the detail and list display",
            "Formatted \"$12,500\""
          ],
          [
            "Edit the price to 999999; Save",
            "List shows \"$999,999\""
          ],
          [
            "Dashboard/global search unaffected",
            "No layout break from wide numbers"
          ]
        ]
      },
      {
        "id": "TC-PROD-008",
        "title": "Feature: Active/Inactive flag effects everywhere",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Toggle a product to Inactive via detail edit",
            "Header pill flips"
          ],
          [
            "Check the list row",
            "Grey Inactive pill"
          ],
          [
            "Open the lead form product dropdown",
            "Inactive product still selectable (inactive ≠ deleted)"
          ],
          [
            "Check the seeded inactive product on fresh seed",
            "Exactly one seeded Inactive item exists (deterministic)"
          ],
          [
            "Toggle back to Active",
            "Pills restore on both surfaces"
          ],
          [
            "Reload between every step",
            "Flag persists each time"
          ]
        ]
      },
      {
        "id": "TC-PROD-009",
        "title": "Journey: product launch to sunset with pipeline attached",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create \"AI Copilot Add-on\" ($30k, auto-SKU)",
            "Detail landing; Active"
          ],
          [
            "Generate 2 leads via the prefill button (different companies)",
            "\"Leads generated (2)\""
          ],
          [
            "Convert one lead with a deal",
            "Deal on the kanban; product still shows the converted lead"
          ],
          [
            "Global search \"Copilot\"",
            "Product (with SKU) and the deal both in grouped results"
          ],
          [
            "Quarter ends: edit → toggle Inactive",
            "Inactive pill on list and detail"
          ],
          [
            "Sunset: Delete → type-name gate → confirm",
            "Product removed; toast mentions 2 leads unlinked"
          ],
          [
            "Open both leads",
            "Both survive with product \"—\""
          ],
          [
            "Lead form dropdown + global search",
            "Product gone from both — no dangling references"
          ]
        ]
      },
      {
        "id": "TC-PROD-010",
        "title": "Journey: catalog integrity under churn",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create products A and B",
            "Both land on detail; list shows both newest-first"
          ],
          [
            "Attach one lead to A and one to B via prefill",
            "Each panel shows (1)"
          ],
          [
            "Move B’s lead over to product A (lead detail edit)",
            "A panel (2); B panel (0)"
          ],
          [
            "Delete B",
            "Simple confirm (no leads anymore)"
          ],
          [
            "Delete A with the type-name gate",
            "Both leads unlinked, verified on their details"
          ],
          [
            "Search the list for A and B",
            "Neither found; seed 12 intact"
          ],
          [
            "Reset data",
            "Exactly 12 products return (deterministic)"
          ]
        ]
      }
    ]
  },
  {
    "name": "Contacts",
    "cases": [
      {
        "id": "TC-CONT-001",
        "title": "Create a contact: validation, account link, tags, detail landing",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Contact\"",
            "/contacts/new form page"
          ],
          [
            "Create with empty form",
            "Name and email errors"
          ],
          [
            "Fill name/email \"bad@\"; Create",
            "Email format error remains"
          ],
          [
            "Fix email; add phone and title",
            "Accepted"
          ],
          [
            "Pick an account via the searchable select (type to filter)",
            "Options narrow; selection shown"
          ],
          [
            "Add tags vip + decision-maker via the multi-select",
            "Chips render in the trigger; removable via ×"
          ],
          [
            "Click Create contact",
            "Lands on the contact DETAIL page; toast; tags visible"
          ],
          [
            "Breadcrumb to Contacts; search the name",
            "Card present with account and tag chips"
          ]
        ]
      },
      {
        "id": "TC-CONT-002",
        "title": "List presentation: grid/list toggle, search, hover actions, truncation tooltip",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open Contacts",
            "Grid of avatar cards by default"
          ],
          [
            "Search a seed contact",
            "Cards filter to matches"
          ],
          [
            "Toggle to List view",
            "Same records as table rows; search term still applied"
          ],
          [
            "Toggle back to Grid",
            "View preference honoured without losing the filter"
          ],
          [
            "Hover a card",
            "\"View profile\" action appears only on hover"
          ],
          [
            "Click View profile",
            "Detail page opens"
          ],
          [
            "Back; hover a truncated email in either view",
            "Custom tooltip reveals the full address"
          ],
          [
            "Clear search",
            "All 40 contacts return"
          ]
        ]
      },
      {
        "id": "TC-CONT-003",
        "title": "Detail: tabs, overview edit with cancel/save, activity trail, bad-id route",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a contact detail",
            "Tabs: Overview / Activity / Notes (n) / Files (n); header avatar + title line"
          ],
          [
            "Overview → Edit; change title, switch account, add a tag; Cancel",
            "Read view returns with ORIGINAL values"
          ],
          [
            "Edit again; same changes; Save",
            "Toast; all values persisted after reload"
          ],
          [
            "Remove a tag via the multi-select chip ×; Save",
            "Tag gone from the read view"
          ],
          [
            "Activity tab",
            "Contains the creation entry (and note events as they occur)"
          ],
          [
            "Notes tab shows the count in its label",
            "Count accurate"
          ],
          [
            "Change the URL to /contacts/bad-id",
            "\"Contact not found.\" with a back link"
          ],
          [
            "Use the back link",
            "Contacts list loads normally"
          ]
        ]
      },
      {
        "id": "TC-CONT-004",
        "title": "Media: avatar upload persistence and file attachments",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "On a contact detail click Upload photo; choose a PNG",
            "Preview replaces the initials immediately; toast"
          ],
          [
            "Reload the detail page",
            "Avatar persisted"
          ],
          [
            "Check the grid card and the list-view row",
            "Both render the avatar image"
          ],
          [
            "Files tab: attach a file",
            "Listed with name + KB; tab count +1"
          ],
          [
            "Attach a second file; remove the first",
            "Exactly one remains; count correct"
          ],
          [
            "Reload",
            "File list persisted"
          ],
          [
            "Upload a different avatar",
            "Replaces the previous one"
          ]
        ]
      },
      {
        "id": "TC-CONT-005",
        "title": "Notes lifecycle and guarded deletion with content counts",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Notes tab: add \"Prefers email contact\"",
            "Note on top; tab label count +1; toast"
          ],
          [
            "Add a second note; delete the first",
            "Correct note removed; count accurate"
          ],
          [
            "Activity tab",
            "Note-added entries present with timestamps"
          ],
          [
            "Click the header Delete button",
            "Modal states EXACT counts: \"…1 note(s) and N file(s) will be deleted…\""
          ],
          [
            "Cancel",
            "Contact intact"
          ],
          [
            "Delete and confirm",
            "Toast; navigated to /contacts; card gone"
          ],
          [
            "Search the deleted name",
            "No results; reload confirms persistence"
          ]
        ]
      },
      {
        "id": "TC-CONT-006",
        "title": "Feature: tags multi-select — add, remove, persist, render",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "On a contact edit, open the tags multi-select",
            "Six options with checkboxes"
          ],
          [
            "Tick vip and partner",
            "Chips appear in the trigger immediately"
          ],
          [
            "Untick partner from the open menu",
            "Chip removed live"
          ],
          [
            "Re-add it, then remove via the chip × without opening the menu",
            "Both removal paths work"
          ],
          [
            "Save with 2 tags; reload",
            "Persisted"
          ],
          [
            "Verify the grid card and list view",
            "Tag chips render on both"
          ],
          [
            "Verify a contact with 0 tags",
            "No empty chip artifacts"
          ]
        ]
      },
      {
        "id": "TC-CONT-007",
        "title": "Feature: avatar upload pipeline",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "On a contact with no avatar",
            "Initials placeholder shown (2 letters, correct)"
          ],
          [
            "Upload a PNG",
            "Immediate preview replaces initials; toast"
          ],
          [
            "Reload the detail",
            "Persisted (stored as data URL)"
          ],
          [
            "Check grid card, list row, and detail header",
            "All three surfaces show the image"
          ],
          [
            "Upload a different image",
            "Replaces the first everywhere"
          ],
          [
            "Delete the contact (cleanup)",
            "No orphaned artifacts"
          ]
        ]
      },
      {
        "id": "TC-CONT-008",
        "title": "Feature: truncation tooltip on long emails",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Create a contact with a very long email (40+ chars)",
            "Created"
          ],
          [
            "Find it in the grid",
            "Email visually truncated with ellipsis"
          ],
          [
            "Hover the truncated email",
            "Custom tooltip shows the FULL address"
          ],
          [
            "Check the list view too",
            "Same truncation + tooltip behavior"
          ],
          [
            "Hover a short email",
            "Tooltip still shows (attribute-driven) but matches the visible text"
          ],
          [
            "Move the pointer away",
            "Tooltip disappears"
          ]
        ]
      },
      {
        "id": "TC-CONT-009",
        "title": "Journey: contact enrichment from cold create to full profile",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create a contact linked to Zenith Corp with 2 tags",
            "Detail landing"
          ],
          [
            "Upload an avatar; reload",
            "Persisted; shown on the grid card too"
          ],
          [
            "Add 2 notes; delete 1; attach a file",
            "Counts track every change"
          ],
          [
            "Edit: promote the title to \"VP Engineering\"",
            "Persisted"
          ],
          [
            "Open the linked account from Contacts context (via account detail accordion)",
            "Contact listed under Related contacts"
          ],
          [
            "Global search the contact’s first name",
            "Appears under Contact results; click navigates back to detail"
          ],
          [
            "Activity tab tells the story",
            "Creation + note entries in order"
          ],
          [
            "Delete with counts modal; verify list",
            "Clean removal"
          ]
        ]
      },
      {
        "id": "TC-CONT-010",
        "title": "Journey: conversion-born contact carries its lineage",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Convert a lead (existing account branch)",
            "Contact created automatically"
          ],
          [
            "Open the new contact",
            "Tag \"imported\" present; account = the chosen account; email/phone copied from the lead"
          ],
          [
            "Enrich: add a note \"Came from lead conversion\" and one more tag",
            "Saved"
          ],
          [
            "Open the account detail",
            "Contact listed in Related contacts accordion"
          ],
          [
            "Delete the original (converted) lead",
            "Warning honoured — the contact SURVIVES"
          ],
          [
            "Re-open the contact",
            "Fully intact with its enrichments"
          ],
          [
            "Delete the contact with the counts modal",
            "Removed cleanly; account unaffected"
          ]
        ]
      }
    ]
  },
  {
    "name": "Accounts",
    "cases": [
      {
        "id": "TC-ACC-001",
        "title": "Create an account: URL validation, owner assignment, detail landing",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Account\"",
            "/accounts/new opens"
          ],
          [
            "Create with an empty name",
            "\"Account name is required.\""
          ],
          [
            "Name BrightWave Media; website \"not-a-url\"; Create",
            "\"Enter a valid URL (starting with http:// or https://).\""
          ],
          [
            "Fix website to https://brightwave.example.com",
            "Accepted"
          ],
          [
            "Set industry via dropdown, employees 120, revenue 5000000, phone, owner Riya Rep",
            "All widgets work"
          ],
          [
            "Click Create account",
            "\"Creating…\" then lands on the account DETAIL page"
          ],
          [
            "Verify the detail",
            "All values formatted (revenue as $); accordions show 0 related records"
          ],
          [
            "Breadcrumb to Accounts; search BrightWave",
            "Row present with owner Riya Rep"
          ]
        ]
      },
      {
        "id": "TC-ACC-002",
        "title": "List: search, website new-tab isolation, row navigation",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Search accounts by a name fragment",
            "Rows filter"
          ],
          [
            "Clear; search by an industry term (\"Finance\")",
            "Industry matches shown"
          ],
          [
            "Click \"Visit site ⇗\" on a row",
            "NEW browser tab opens the site; the CRM tab stays on the list (row click not triggered)"
          ],
          [
            "Close the new tab; click the same row’s body",
            "Account detail opens"
          ],
          [
            "Use the breadcrumb to return",
            "List state preserved"
          ],
          [
            "Search gibberish",
            "Empty state row"
          ],
          [
            "Clear",
            "All 20 seed accounts return"
          ]
        ]
      },
      {
        "id": "TC-ACC-003",
        "title": "Detail: edit save/cancel and independently nested accordions",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a seeded account with relations (e.g. Zenith Corp)",
            "Detail with dl values + two accordions with count badges"
          ],
          [
            "Edit; change industry and phone; Cancel",
            "Original values restored"
          ],
          [
            "Edit; same changes; Save; reload",
            "Persisted"
          ],
          [
            "Expand \"Related contacts\"",
            "Contacts listed; each name links to its contact detail"
          ],
          [
            "Expand \"Related deals\", then one inner deal accordion",
            "Inner accordions expand independently; stage/probability/close date shown"
          ],
          [
            "Collapse the outer deals accordion",
            "Inner state contained; contacts accordion unaffected"
          ],
          [
            "Navigate to a related contact and back via breadcrumbs",
            "Round trip clean"
          ]
        ]
      },
      {
        "id": "TC-ACC-004",
        "title": "Delete guard: blocked by open deals with actionable links",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Create an account; link a contact and an OPEN deal to it",
            "Both appear in its accordions"
          ],
          [
            "Click Delete on the account",
            "BLOCKED modal: \"This account has N open deal(s). Close or delete them first.\" — no confirm button"
          ],
          [
            "Verify each open deal is listed as a link",
            "Links present with stage and amount"
          ],
          [
            "Click a deal link",
            "Navigates to that deal’s detail page"
          ],
          [
            "Set the deal to Closed Lost; Save; return to the account",
            "Accordion reflects the closed stage"
          ],
          [
            "Click Delete again",
            "No longer blocked — the unlink/cascade choice appears instead"
          ],
          [
            "Cancel (deletion tested separately)",
            "Account intact"
          ]
        ]
      },
      {
        "id": "TC-ACC-005",
        "title": "Delete branches: unlink preserves orphans, cascade removes them",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Prepare account X with 1 contact + 1 CLOSED deal; Delete → keep radio \"unlink\"; confirm",
            "Toast; back on the list; X gone"
          ],
          [
            "Open the former contact and deal",
            "Both exist; account field shows \"—\" (orphaned, not deleted)"
          ],
          [
            "Prepare account Y the same way; Delete → choose \"Delete the related contacts and closed deals too\"; confirm",
            "Y deleted"
          ],
          [
            "Search Y’s contact in Contacts",
            "Gone"
          ],
          [
            "Search Y’s deal on the Deals board",
            "Gone; column totals consistent"
          ],
          [
            "Audit log",
            "account.delete entries recorded with the chosen mode"
          ],
          [
            "Reset data",
            "Seed restored for other cases"
          ]
        ]
      },
      {
        "id": "TC-ACC-006",
        "title": "Feature: website URL validation and safe new-tab behavior",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Create attempt with website \"ftp://site.com\"",
            "Rejected (http/https required)"
          ],
          [
            "\"www.site.com\" (no scheme)",
            "Rejected"
          ],
          [
            "\"https://site\"",
            "Rejected (needs a dot)"
          ],
          [
            "\"https://site.example.com\" and empty website",
            "Both accepted (field is optional)"
          ],
          [
            "On the list, click \"Visit site ⇗\"",
            "Opens in a NEW tab; the CRM tab does not navigate"
          ],
          [
            "Verify the row-click zone",
            "Clicking outside the link still opens the account detail"
          ],
          [
            "Account without a website",
            "Shows \"—\", no dead link"
          ]
        ]
      },
      {
        "id": "TC-ACC-007",
        "title": "Feature: numeric fields — employees and revenue formatting",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Open an account detail",
            "Employees rendered with thousands separators; revenue as $-formatted"
          ],
          [
            "Edit employees to 12345; Save",
            "List shows \"12,345\""
          ],
          [
            "Edit revenue to 2500000; Save",
            "\"$2,500,000\" on list and detail"
          ],
          [
            "Enter 0 for both; Save",
            "Displays \"0\" and \"$0\" without errors"
          ],
          [
            "Sort/scan the list",
            "Numeric columns right-aligned and consistent"
          ],
          [
            "Reload",
            "Values persisted"
          ]
        ]
      },
      {
        "id": "TC-ACC-008",
        "title": "Journey: account 360 build-out and guarded teardown",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create an account with full details",
            "Detail landing"
          ],
          [
            "Add a contact (via Contacts form) and a deal (via Deals form) linked to it",
            "Both visible in the account accordions with correct badges"
          ],
          [
            "Open the deal from the inner accordion link; raise the amount; Save",
            "Account view reflects it after reload"
          ],
          [
            "Attempt account Delete",
            "Blocked; open deal listed"
          ],
          [
            "Close the deal via its link (Closed Lost)",
            "Guard re-evaluates"
          ],
          [
            "Delete → unlink",
            "Contact and closed deal survive orphaned"
          ],
          [
            "Re-link the orphan contact to Zenith Corp via contact edit",
            "Data healable after unlink"
          ],
          [
            "Audit log tells the full story",
            "create/edit/delete entries in order"
          ]
        ]
      },
      {
        "id": "TC-ACC-009",
        "title": "Journey: growing an existing customer (expansion motion)",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Open Zenith Corp; review related contacts and deals",
            "Baseline counts noted"
          ],
          [
            "New stakeholder: create a contact linked to Zenith with tag decision-maker",
            "Appears in the account accordion (+1)"
          ],
          [
            "Upsell: create deal \"Zenith Expansion\" $120k linked to Zenith",
            "Deals accordion +1; kanban shows the card"
          ],
          [
            "Drag the deal Qualification → Proposal → Negotiation → Closed Won",
            "Totals shift at every hop"
          ],
          [
            "Account detail",
            "Inner accordion shows the deal at Closed Won"
          ],
          [
            "Dashboard",
            "Won revenue includes the $120k this month"
          ],
          [
            "Global search \"Zenith\"",
            "Account, its contacts, and the deal all reachable"
          ]
        ]
      }
    ]
  },
  {
    "name": "Deals",
    "cases": [
      {
        "id": "TC-DEAL-001",
        "title": "Create a deal: every custom widget on the form page",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Deal\"",
            "/deals/new opens"
          ],
          [
            "Create with an empty name",
            "Error banner \"Deal name is required.\""
          ],
          [
            "Type 75000 into Amount and blur",
            "Reformats to 75,000"
          ],
          [
            "Account searchable select: type \"xyz\"",
            "\"No matches found\""
          ],
          [
            "Clear; type \"Iron\"; pick Ironleaf Media",
            "Selection shown"
          ],
          [
            "Date picker: navigate forward two months; pick the 15th",
            "Input shows the formatted date; popup closes"
          ],
          [
            "Set the probability slider to 60",
            "Label live-updates \"Win probability: 60%\""
          ],
          [
            "Stage = Proposal via dropdown; Create deal",
            "Lands on the deal DETAIL page"
          ],
          [
            "Verify every field on the detail",
            "Amount $75,000, account link, date, 60%, Proposal — all round-tripped"
          ]
        ]
      },
      {
        "id": "TC-DEAL-002",
        "title": "Board integrity: column math, empty-column placeholder, card content",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open Deals on fresh seed",
            "5 columns in pipeline order"
          ],
          [
            "For each column, sum its card amounts",
            "Header \"count · $total\" matches exactly, all 5 columns"
          ],
          [
            "Inspect a card",
            "Name, account, amount, probability, close date all shown"
          ],
          [
            "Move every card out of one column (drag)",
            "Emptied column shows the dashed \"Drop deals here\" placeholder"
          ],
          [
            "Drop a card onto the placeholder",
            "Card lands; placeholder replaced"
          ],
          [
            "Reload",
            "All positions persisted; totals still exact"
          ],
          [
            "Reset data",
            "Deterministic board restored"
          ]
        ]
      },
      {
        "id": "TC-DEAL-003",
        "title": "Drag semantics: cross-column moves, same-column no-op, persistence",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Drag a card Qualification → Proposal",
            "Toast \"…moved to Proposal.\"; both totals shift by the card amount"
          ],
          [
            "Drag it Proposal → Negotiation",
            "Same correctness"
          ],
          [
            "Drag it onto its own column",
            "No toast, no change"
          ],
          [
            "Reload the page",
            "Card still in Negotiation"
          ],
          [
            "Drag it back to Qualification",
            "Totals return to the original values"
          ],
          [
            "Verify the dashboard pipeline tile",
            "Unchanged by moves within open stages"
          ],
          [
            "Drag to Closed Won and check the dashboard",
            "Pipeline decreases; won revenue increases"
          ]
        ]
      },
      {
        "id": "TC-DEAL-004",
        "title": "Editing parity: card modal vs detail page stay consistent",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click a kanban card",
            "Edit modal opens pre-filled"
          ],
          [
            "Change the amount (blur reformats); Save",
            "Card and column total update immediately"
          ],
          [
            "Open the same deal’s detail page",
            "Shows the modal’s change"
          ],
          [
            "Detail Edit: change stage via dropdown and probability via slider; Save",
            "Persisted"
          ],
          [
            "Return to the board",
            "Card sits in the new column with the new probability"
          ],
          [
            "Modal again: change the close date via the date picker; Save",
            "Detail shows the new date"
          ],
          [
            "Reload everything",
            "Both surfaces agree on every field"
          ]
        ]
      },
      {
        "id": "TC-DEAL-005",
        "title": "Delete gate matrix: open deals, kanban refusal, Closed Won typed confirmation",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open a non-closed deal’s detail; Delete",
            "Simple confirm modal naming amount and stage"
          ],
          [
            "Cancel, then confirm",
            "Deal removed; board totals updated"
          ],
          [
            "Click a Closed Won card; press Delete inside the modal",
            "REFUSED: toast \"Closed Won deals can only be deleted from their detail page.\""
          ],
          [
            "Open that deal’s detail; click Delete",
            "Warning about won revenue + \"Type DELETE to confirm\"; button disabled"
          ],
          [
            "Type \"delete\" in lowercase",
            "Still disabled (exact match)"
          ],
          [
            "Type DELETE",
            "Button enables"
          ],
          [
            "Confirm",
            "Deal deleted; navigated to /deals; Closed Won total reduced"
          ],
          [
            "Audit log",
            "deal.delete recorded with stage"
          ]
        ]
      },
      {
        "id": "TC-DEAL-006",
        "title": "Feature: currency amount input — formatting and sanitization",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Type \"75000\" and blur",
            "Reformats to \"75,000\""
          ],
          [
            "Refocus and append \"abc\"; blur",
            "Non-numerics stripped; number preserved"
          ],
          [
            "Clear and type \"1,2,3,4\"; blur",
            "Parsed to 1,234"
          ],
          [
            "Type \"0\"; blur; save the deal",
            "Stored as $0 (allowed for deals)"
          ],
          [
            "Type \"99.99\"; blur",
            "Rounded to the nearest whole number"
          ],
          [
            "Verify the kanban card and the column total",
            "Both reflect the final stored value"
          ],
          [
            "Reopen the modal",
            "Input shows the formatted stored amount"
          ]
        ]
      },
      {
        "id": "TC-DEAL-007",
        "title": "Feature: custom date picker — navigation and selection",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Open the close-date picker",
            "Calendar popup with weekday headers"
          ],
          [
            "Navigate back one month, then forward two",
            "Header month/year label updates correctly"
          ],
          [
            "Cross a year boundary (navigate from January backwards)",
            "Year decrements correctly"
          ],
          [
            "Verify today",
            "Outlined \"today\" marker on the current date"
          ],
          [
            "Pick a day",
            "Popup closes; input shows the formatted date; day highlighted on reopen"
          ],
          [
            "Click outside the popup instead of picking",
            "Closes without changing the value"
          ],
          [
            "Save and reload",
            "Chosen date persisted"
          ]
        ]
      },
      {
        "id": "TC-DEAL-008",
        "title": "Feature: probability slider live label and persistence",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Open a deal edit; note the label \"Win probability: N%\"",
            "Matches the slider position"
          ],
          [
            "Drag to 0",
            "Label \"0%\""
          ],
          [
            "Drag to 100",
            "Label \"100%\""
          ],
          [
            "Use keyboard arrows on the focused slider",
            "Steps of 5 update the label live"
          ],
          [
            "Save at 65%",
            "Kanban card shows 65%"
          ],
          [
            "Reload and reopen",
            "Slider restored at 65"
          ]
        ]
      },
      {
        "id": "TC-DEAL-009",
        "title": "Feature: deal without an account",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Create a deal leaving the account select untouched",
            "Creation succeeds (account optional)"
          ],
          [
            "Verify the kanban card",
            "Shows \"No account\" where the account name would be"
          ],
          [
            "Open the deal detail",
            "Account row shows \"—\" (no dead link)"
          ],
          [
            "Edit and attach an account; Save",
            "Card and detail now show the account"
          ],
          [
            "Edit again; note there is no \"clear account\" option once set",
            "Document actual behavior (selection is replace-only)"
          ],
          [
            "Delete the test deal",
            "Board totals restore"
          ]
        ]
      },
      {
        "id": "TC-DEAL-010",
        "title": "Feature: searchable account select behavior",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Open the account select on the deal form",
            "Filter input autofocuses"
          ],
          [
            "Type \"zen\"",
            "List narrows to Zenith Corp"
          ],
          [
            "Type \"zzz\"",
            "\"No matches found\" row"
          ],
          [
            "Clear the filter",
            "Full list returns"
          ],
          [
            "Select an option",
            "Menu closes; trigger shows the selection"
          ],
          [
            "Reopen",
            "Selected option visually marked; filter reset"
          ],
          [
            "Click outside while open",
            "Closes without changing the selection"
          ]
        ]
      },
      {
        "id": "TC-DEAL-011",
        "title": "Journey: deal lifecycle across the entire pipeline with gated exit",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create a $90k deal with all widgets exercised",
            "Detail landing verified"
          ],
          [
            "Walk it across all four hops to Closed Won by drag",
            "Toast + exact totals at every stage"
          ],
          [
            "Dashboard checkpoint",
            "Pipeline back to baseline; won revenue +$90k"
          ],
          [
            "Attempt kanban-modal delete",
            "Refused with the redirect-to-detail toast"
          ],
          [
            "Detail delete with the DELETE gate",
            "Typed confirmation enforced, then removed"
          ],
          [
            "Dashboard again",
            "Won revenue back down — chart reflects the deletion"
          ],
          [
            "Audit log",
            "create, stage moves, delete — the deal’s whole life recorded"
          ]
        ]
      },
      {
        "id": "TC-DEAL-012",
        "title": "Journey: quarter-end pipeline sweep",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create three deals ($20k, $50k, $30k) in Qualification",
            "Column count +3; total +$100k"
          ],
          [
            "Advance the $50k to Negotiation and the $20k to Proposal",
            "Totals correct at each column"
          ],
          [
            "Close the $30k as Lost (drag)",
            "Open pipeline drops by $30k; Closed Lost grows"
          ],
          [
            "Close the $50k as Won",
            "Won total +$50k; dashboard won revenue reflects it"
          ],
          [
            "The $20k stalls: open detail, drop probability to 10%, note the close date next week",
            "Persisted"
          ],
          [
            "Verify board totals sum: open + closed = all deals",
            "Math holds across all 5 columns"
          ],
          [
            "Reset data",
            "Sweep leaves no residue"
          ]
        ]
      }
    ]
  },
  {
    "name": "Tasks",
    "cases": [
      {
        "id": "TC-TASK-001",
        "title": "Quick-add: validation, date picker, Enter submission, top placement",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ Add task\" with an empty title",
            "Error toast \"Task title is required.\""
          ],
          [
            "Type \"Prepare demo env\"; priority High via dropdown",
            "Widgets accept values"
          ],
          [
            "Open the due-date picker; navigate to next month; pick the 15th",
            "Input shows the formatted date"
          ],
          [
            "Click \"+ Add task\"",
            "Task appears at the TOP of the list with priority + due badge"
          ],
          [
            "Type a second title and press Enter inside the input",
            "Enter also submits; second task on top"
          ],
          [
            "Reload the page",
            "Both tasks persisted in order"
          ],
          [
            "Verify the due badges",
            "Future dates show \"Due {date}\" (not overdue styling)"
          ]
        ]
      },
      {
        "id": "TC-TASK-002",
        "title": "Native dialogs: overdue-completion alert and delete confirm pair",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Filter chip Overdue",
            "Only overdue, non-completed tasks; red left border + Overdue pill"
          ],
          [
            "Tick an overdue task’s checkbox",
            "window.alert fires: \"Heads up: … was overdue…\""
          ],
          [
            "Accept the alert",
            "Task struck through; success toast"
          ],
          [
            "Chip Completed",
            "The task is listed there"
          ],
          [
            "Untick it",
            "Reopens; leaves the Completed view"
          ],
          [
            "Back in All: click a task’s 🗑; CANCEL the confirm",
            "Task remains"
          ],
          [
            "Delete again; ACCEPT",
            "Task gone; toast; count updated"
          ],
          [
            "Reload",
            "Deletion persisted"
          ]
        ]
      },
      {
        "id": "TC-TASK-003",
        "title": "Filter chips partition correctly and stay consistent",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Note counts under All",
            "Baseline"
          ],
          [
            "Chip Open",
            "Only non-completed tasks"
          ],
          [
            "Chip Completed",
            "Only completed; strikethrough styling"
          ],
          [
            "Chip Overdue",
            "Subset of Open with overdue styling"
          ],
          [
            "Verify the math",
            "Open + Completed = All; Overdue ⊆ Open"
          ],
          [
            "Complete one task from Open",
            "It moves between chips correctly"
          ],
          [
            "Add a task while in the Completed view",
            "Created; visible under All/Open, not Completed"
          ]
        ]
      },
      {
        "id": "TC-TASK-004",
        "title": "Reordering and inline priority: persistence and view constraints",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "In the All view, drag row 6 to position 2",
            "Order updates immediately"
          ],
          [
            "Reload",
            "Order persisted"
          ],
          [
            "Drag the bottom task to the top",
            "Works across the full list"
          ],
          [
            "Switch to Open/Completed/Overdue chips",
            "NO drag handle in filtered views"
          ],
          [
            "Back in All: change a task’s priority via its row dropdown",
            "Value updates in place"
          ],
          [
            "Reload",
            "Priority persisted"
          ],
          [
            "Verify overdue badge styling unaffected by reorder",
            "Consistent rendering"
          ]
        ]
      },
      {
        "id": "TC-TASK-005",
        "title": "Feature: due-date badges and overdue visual state",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Locate a task due in the future",
            "Grey \"Due {date}\" pill; no red border"
          ],
          [
            "Locate an overdue, non-completed task",
            "Red left border + red \"Overdue · {date}\" pill"
          ],
          [
            "Complete the overdue task (accept the alert)",
            "Struck through; overdue styling logic no longer highlights it as actionable"
          ],
          [
            "Reopen it",
            "Overdue styling returns (still past due)"
          ],
          [
            "Add a task due today via the picker",
            "Badge shows today’s date; not overdue styling"
          ],
          [
            "Verify in dark theme",
            "Badges and borders remain legible"
          ]
        ]
      },
      {
        "id": "TC-TASK-006",
        "title": "Feature: quick-add input parity — button vs Enter key",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Type a title; click \"+ Add task\"",
            "Task added; input cleared"
          ],
          [
            "Type another; press Enter inside the input",
            "Identical behavior"
          ],
          [
            "Press Enter with an empty input",
            "Error toast; nothing added"
          ],
          [
            "Set priority + date first, then add",
            "Both attributes applied to the created task"
          ],
          [
            "Add two tasks back-to-back quickly",
            "Both created; order newest-on-top"
          ],
          [
            "Reload",
            "All persisted"
          ]
        ]
      },
      {
        "id": "TC-TASK-007",
        "title": "Journey: a rep’s working day in tasks",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Morning: chip Overdue; complete each overdue task, accepting every alert",
            "Alerts fire per task; all struck through"
          ],
          [
            "Add three tasks for today/tomorrow/next week with varied priorities",
            "All land on top with correct badges"
          ],
          [
            "Reorder them into priority order by drag",
            "Persists on reload"
          ],
          [
            "Midday: complete today’s task",
            "No alert (not overdue); moves to Completed"
          ],
          [
            "A meeting cancels: delete tomorrow’s task (confirm accepted)",
            "Removed"
          ],
          [
            "Chip audit at day’s end",
            "All/Open/Completed/Overdue counts all reconcile"
          ],
          [
            "Dashboard \"Tasks due today\"",
            "Reflects the completions"
          ]
        ]
      },
      {
        "id": "TC-TASK-008",
        "title": "Journey: overdue firefight with dialog discipline",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create a task due today via the picker, then reset-date it… (verify a seeded overdue task instead)",
            "At least one overdue task available"
          ],
          [
            "Attempt completing it but CANCEL nothing — the alert has only OK; accept it",
            "Alert text captured; completion proceeds"
          ],
          [
            "Reopen the same task",
            "Overdue styling returns (still past due)"
          ],
          [
            "Delete it; dismiss the confirm first",
            "Still present — dismissal honoured"
          ],
          [
            "Delete again; accept",
            "Gone; toast"
          ],
          [
            "Verify under every chip",
            "Absent everywhere"
          ],
          [
            "Reload",
            "State persisted"
          ]
        ]
      }
    ]
  },
  {
    "name": "Tickets",
    "cases": [
      {
        "id": "TC-TIK-001",
        "title": "Create a ticket: validation, detail landing, live SLA",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click \"+ New Ticket\"",
            "/tickets/new form page"
          ],
          [
            "Create with an empty form",
            "Subject and Requester field errors"
          ],
          [
            "Fill subject \"Payment gateway timeout\", requester \"QA Bot\"",
            "Accepted"
          ],
          [
            "Priority Urgent via dropdown; description text; Create ticket",
            "\"Creating…\" then lands on the ticket DETAIL page"
          ],
          [
            "Verify the header",
            "Status pill Open; Urgent priority select"
          ],
          [
            "Watch the SLA line for 3 seconds",
            "Countdown text decreases every second (h/m/s format)"
          ],
          [
            "Return to the list",
            "Ticket present with Open + Urgent pills and \"Within SLA\""
          ],
          [
            "Filter chip Open",
            "Ticket included"
          ]
        ]
      },
      {
        "id": "TC-TIK-002",
        "title": "Workflow matrix: only mapped transitions at every status",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "On an Open ticket, inspect the transition buttons",
            "Exactly [In Progress, Closed]"
          ],
          [
            "Click In Progress",
            "Pill updates; toast; buttons now exactly [Resolved, Open]"
          ],
          [
            "Click Resolved",
            "Buttons exactly [Closed, In Progress]"
          ],
          [
            "Click Closed",
            "Buttons exactly [Open]; SLA line shows \"not applicable\""
          ],
          [
            "Click Open (reopen)",
            "Full cycle allowed; SLA line resumes if due date is future"
          ],
          [
            "Walk it back to Closed",
            "Each hop toasts and re-renders the correct button set"
          ],
          [
            "Reload at Closed",
            "Status persisted"
          ],
          [
            "List view",
            "Status pill and SLA column agree"
          ]
        ]
      },
      {
        "id": "TC-TIK-003",
        "title": "Comment thread: canned responses, add, edit-own, delete, permissions",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open the canned-response dropdown; pick \"Request more info\"",
            "Textarea auto-fills with the canned text"
          ],
          [
            "Append custom text; Add comment",
            "Comment in thread; author = logged-in user; count +1"
          ],
          [
            "Edit the comment; change text; Save",
            "Updated in place"
          ],
          [
            "Cancel an edit midway",
            "Original text retained"
          ],
          [
            "Add a second comment; delete the first via the confirm",
            "Correct one removed; count accurate"
          ],
          [
            "Locate a seeded comment by another author (Riya Rep) while logged in as admin",
            "NO Edit/Delete controls on it"
          ],
          [
            "Reload",
            "Thread persisted"
          ]
        ]
      },
      {
        "id": "TC-TIK-004",
        "title": "Attachments, priority persistence, and SLA breach presentation",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "On a ticket detail, add an attachment",
            "Listed with filename + KB size; toast"
          ],
          [
            "Add a second; reload",
            "Both persisted"
          ],
          [
            "Change priority via the select",
            "Toast; pill updates in the list after navigation"
          ],
          [
            "Find a seeded Open/In-Progress ticket whose SLA has passed",
            "List shows the red \"Breached\" pill"
          ],
          [
            "Open it",
            "Detail shows \"SLA breached\""
          ],
          [
            "Resolve and close it",
            "SLA area becomes \"not applicable\""
          ],
          [
            "Return to the list",
            "\"—\" in the SLA column for the closed ticket"
          ]
        ]
      },
      {
        "id": "TC-TIK-005",
        "title": "Delete rules: blocked at every active status, allowed with counts when Closed",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "On an OPEN ticket click Delete",
            "Blocked modal \"Only Closed tickets can be deleted…\"; no confirm button"
          ],
          [
            "Move to In Progress; Delete",
            "Still blocked"
          ],
          [
            "Move to Resolved; Delete",
            "Still blocked"
          ],
          [
            "Move to Closed; Delete",
            "Confirm modal appears stating exact comment and attachment counts"
          ],
          [
            "Cancel",
            "Ticket intact"
          ],
          [
            "Delete and confirm",
            "Toast; navigated to /tickets; row gone"
          ],
          [
            "Reload the list",
            "Deletion persisted; counts consistent"
          ]
        ]
      },
      {
        "id": "TC-TIK-006",
        "title": "Feature: SLA countdown — format, tick cadence, terminal states",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Open an active ticket with future SLA",
            "Format \"⏱ SLA due in Xh YYm ZZs\""
          ],
          [
            "Observe for 5 seconds",
            "Seconds decrement each second; minutes roll over correctly"
          ],
          [
            "Verify tabular rendering",
            "Text width stable (no layout jitter)"
          ],
          [
            "Open a breached active ticket",
            "\"SLA breached\" pill instead of a countdown"
          ],
          [
            "Close a ticket and check",
            "\"not applicable\" message; timer stops"
          ],
          [
            "Reopen it",
            "Countdown resumes only if the due time is still in the future"
          ]
        ]
      },
      {
        "id": "TC-TIK-007",
        "title": "Feature: canned responses fill and overwrite the composer",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Pick \"Acknowledgement\" from the canned dropdown",
            "Textarea filled with the canned text"
          ],
          [
            "Pick \"Escalation\" next",
            "Textarea REPLACED with the new canned text"
          ],
          [
            "Append custom words after a canned pick",
            "Free editing allowed"
          ],
          [
            "Pick the placeholder option (\"Insert canned response…\")",
            "No change to the textarea"
          ],
          [
            "Post the composed comment",
            "Sent as edited; dropdown resets to placeholder"
          ],
          [
            "Verify each of the four canned texts",
            "Each inserts its full sentence correctly"
          ]
        ]
      },
      {
        "id": "TC-TIK-008",
        "title": "Journey: customer issue from intake to audited cleanup",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create an Urgent ticket with description",
            "Detail landing; SLA counting"
          ],
          [
            "Acknowledge via canned response; move In Progress",
            "Comment + status recorded"
          ],
          [
            "Investigate: add an internal comment and a screenshot attachment",
            "Thread and files grow"
          ],
          [
            "Fix ships: comment \"Resolved in v2.1\"; move Resolved",
            "Transitions stay lawful throughout"
          ],
          [
            "Customer confirms: move Closed",
            "SLA inactive"
          ],
          [
            "Housekeeping: delete the closed ticket (counts shown)",
            "Removed"
          ],
          [
            "Audit log",
            "ticket.create and ticket.delete entries present in order"
          ],
          [
            "List integrity",
            "All chips and counts consistent after the lifecycle"
          ]
        ]
      },
      {
        "id": "TC-TIK-009",
        "title": "Journey: SLA fire drill with escalation",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Identify (or create) a ticket close to its SLA due time",
            "Countdown visibly low"
          ],
          [
            "Watch it breach",
            "Detail flips to \"SLA breached\"; list shows the Breached pill"
          ],
          [
            "Escalate: priority → Urgent; canned \"Escalation\" comment appended and posted",
            "Recorded with author"
          ],
          [
            "Move In Progress → Resolved",
            "Lawful transitions during the firefight"
          ],
          [
            "Close it",
            "SLA not applicable; breach remains part of history (comments tell the story)"
          ],
          [
            "Verify the list",
            "Closed pill; \"—\" SLA"
          ],
          [
            "Audit log",
            "The whole drill traceable"
          ]
        ]
      }
    ]
  },
  {
    "name": "Admin",
    "cases": [
      {
        "id": "TC-ADM-001",
        "title": "User CRUD: add with validation, edit role, verify persistence",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Open Admin → Users",
            "5 seed users with role pills and active switches"
          ],
          [
            "Click \"+ Add user\"; Save empty",
            "Error toast \"Name and a valid email are required.\""
          ],
          [
            "Name \"Tina Tester\", email \"tina@\", Save",
            "Still rejected (email format)"
          ],
          [
            "Fix email tina@crm.com; role Sales Rep; Save",
            "Row appears with Sales Rep pill; toast"
          ],
          [
            "Edit Tina; modal pre-filled; change role to Viewer; Save",
            "Pill updates to Viewer"
          ],
          [
            "Reload the page",
            "All changes persisted"
          ],
          [
            "Audit log tab",
            "user.save entries for both saves, attributed to the admin"
          ]
        ]
      },
      {
        "id": "TC-ADM-002",
        "title": "Activation lifecycle: toggle off blocks login, toggle on restores it",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Toggle Tina’s Active switch OFF",
            "Switch animates; toast \"deactivated\""
          ],
          [
            "Log out; attempt login as Tina",
            "Blocked: \"This account has been deactivated…\""
          ],
          [
            "Log in as admin; verify the switch state",
            "Still OFF after the round trip"
          ],
          [
            "Toggle it ON",
            "Toast \"activated\""
          ],
          [
            "Log out; log in as Tina",
            "Succeeds"
          ],
          [
            "Log back in as admin",
            "Audit shows both toggles in order"
          ],
          [
            "Cleanup: delete Tina (record-free) via the native confirm",
            "Removed"
          ]
        ]
      },
      {
        "id": "TC-ADM-003",
        "title": "Deletion matrix: native confirm, forced reassignment, self-delete block",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Create a fresh record-free user; Delete; CANCEL the native confirm",
            "User remains"
          ],
          [
            "Delete again; accept",
            "Removed with toast"
          ],
          [
            "Click Delete on Sam Sales (owns seed records)",
            "Reassignment modal: \"Sam Sales owns N lead(s), N account(s) and N deal(s)…\""
          ],
          [
            "Cross-check the counts by filtering Leads/Accounts/Deals by owner",
            "Counts accurate"
          ],
          [
            "Inspect the reassign dropdown",
            "Excludes Sam himself AND inactive users (Priya)"
          ],
          [
            "Try \"Reassign & delete\" without choosing",
            "Button disabled"
          ],
          [
            "Choose Riya Rep; confirm",
            "Sam removed; toast names Riya"
          ],
          [
            "Spot-check Leads and Deals owner columns",
            "Former Sam records now Riya’s"
          ],
          [
            "Click Delete on your own admin row",
            "Error toast \"You cannot delete your own account.\"; nothing happens"
          ]
        ]
      },
      {
        "id": "TC-ADM-004",
        "title": "RBAC matrix: rep read-only, viewer forbidden, admin full",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "As admin, verify Admin page controls",
            "Add user, switches, Edit/Delete all enabled"
          ],
          [
            "Log in as rep@crm.com; open Admin",
            "Read-only banner shown"
          ],
          [
            "Inspect every control as rep",
            "+ Add user disabled; all switches disabled; Edit/Delete links disabled"
          ],
          [
            "Attempt the audit tab as rep",
            "Viewable (read-only applies to mutations)"
          ],
          [
            "Log in as viewer@crm.com",
            "Admin absent from the sidebar"
          ],
          [
            "Force /admin via the URL",
            "403 page"
          ],
          [
            "Click \"Back to dashboard\"",
            "Recovers to the dashboard"
          ]
        ]
      },
      {
        "id": "TC-ADM-005",
        "title": "Audit log: ordered recording and per-user filter",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Perform in sequence: a login, a lead save, a user toggle",
            "Actions complete"
          ],
          [
            "Open Admin → Audit log",
            "Newest entries first; the three actions present with correct action codes"
          ],
          [
            "Verify attribution",
            "Each entry names the acting user"
          ],
          [
            "Filter by \"Alex Admin\"",
            "Only Alex’s entries"
          ],
          [
            "Filter by another user",
            "List switches accordingly"
          ],
          [
            "Clear the filter (All users)",
            "Full log returns"
          ],
          [
            "Reload",
            "Log persisted (capped at 200 entries)"
          ]
        ]
      },
      {
        "id": "TC-ADM-006",
        "title": "Feature: active toggle switch component behavior",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Locate a user’s switch (ON)",
            "Green knob right"
          ],
          [
            "Click it",
            "Animates OFF; toast fires; persisted after reload"
          ],
          [
            "Click again",
            "Back ON with toast"
          ],
          [
            "As rep, view the same switch",
            "Rendered but DISABLED (not clickable)"
          ],
          [
            "Keyboard: focus the switch and press Space (as admin)",
            "Toggles (accessible input)"
          ],
          [
            "Verify the row label association",
            "aria-label carries the user’s name"
          ]
        ]
      },
      {
        "id": "TC-ADM-007",
        "title": "Feature: audit log filter and ordering guarantees",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Generate entries as two different users (login/logout each)",
            "Both recorded"
          ],
          [
            "Open the audit log",
            "Strictly newest-first ordering"
          ],
          [
            "Filter by user A",
            "Only A’s entries; ordering preserved"
          ],
          [
            "Filter by user B",
            "Only B’s"
          ],
          [
            "Return to \"All users\"",
            "Merged list again"
          ],
          [
            "Verify the cap",
            "Log never exceeds 200 entries (oldest trimmed)"
          ]
        ]
      },
      {
        "id": "TC-ADM-008",
        "title": "Journey: employee onboarding to offboarding with clean handover",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Admin creates rep \"Rohit Rao\"",
            "Row + audit entry"
          ],
          [
            "Log in as Rohit; personalize profile name in Settings",
            "Topbar initials update"
          ],
          [
            "As Rohit: create one lead and one deal",
            "He owns records now"
          ],
          [
            "Verify Rohit’s limits: Admin page read-only",
            "Banner + disabled controls"
          ],
          [
            "Admin returns: deactivates Rohit",
            "Rohit’s next login blocked"
          ],
          [
            "Admin deletes Rohit",
            "Reassignment modal (1 lead, 1 deal); reassign to Riya"
          ],
          [
            "Verify ownership moved in both modules",
            "Riya owns them"
          ],
          [
            "Audit log",
            "Onboard → work → deactivate → delete: the full story, in order"
          ]
        ]
      },
      {
        "id": "TC-ADM-009",
        "title": "Journey: permission probing across the whole app surface",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "As viewer: visit every sidebar page",
            "All CRM pages usable; Admin absent; /admin → 403"
          ],
          [
            "As viewer: create a lead",
            "Allowed (viewer restriction is admin-area only) — record it"
          ],
          [
            "As rep: open Admin and attempt each control",
            "All disabled; no mutation possible"
          ],
          [
            "As rep: delete the viewer’s lead from its detail",
            "Allowed — CRM data is shared"
          ],
          [
            "As admin: verify audit attribution of all the above",
            "Each action attributed to the correct user"
          ],
          [
            "Reset data",
            "Clean slate"
          ]
        ]
      }
    ]
  },
  {
    "name": "Settings",
    "cases": [
      {
        "id": "TC-SET-001",
        "title": "Profile: full validation matrix and identity propagation",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Clear the name; Save profile",
            "\"Name is required.\""
          ],
          [
            "Restore name; set email \"bad-email\"; Save",
            "Email format error"
          ],
          [
            "Fix email; set phone \"abc\"; Save",
            "Phone format error"
          ],
          [
            "Fix phone (+91 format); Save",
            "Success toast"
          ],
          [
            "Change the name to \"Alexander Admin\"; Save",
            "Topbar avatar initials update to AA→ new initials"
          ],
          [
            "Reload",
            "Profile values persisted"
          ],
          [
            "Open the avatar menu",
            "New name and email shown"
          ]
        ]
      },
      {
        "id": "TC-SET-002",
        "title": "Preferences: toggles and density persist across reload and re-login",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Toggle Push notifications ON",
            "Switch flips immediately"
          ],
          [
            "Toggle Weekly digest OFF; select density Compact",
            "Both update"
          ],
          [
            "Reload the page",
            "All three persisted"
          ],
          [
            "Log out and log back in",
            "Preferences still applied (stored per app, not per session)"
          ],
          [
            "Toggle everything back",
            "Round trip clean"
          ],
          [
            "Reload once more",
            "Restored values persisted"
          ]
        ]
      },
      {
        "id": "TC-SET-003",
        "title": "Help-center iframe: full in-frame interaction and frame switching",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Expand \"Open embedded help center (iframe)\"",
            "Iframe loads the Help Center document"
          ],
          [
            "Switch into the frame; verify the heading",
            "\"📚 Help Center\" present"
          ],
          [
            "Type \"reset\" in the in-frame search",
            "\"Searching for \"reset\"…\" text updates live"
          ],
          [
            "Click the FAQ \"How do I reset the demo data?\"",
            "Answer expands"
          ],
          [
            "Click it again",
            "Collapses"
          ],
          [
            "Switch back to the main page; open a dropdown on the Settings page",
            "Main document fully interactive"
          ],
          [
            "Collapse the accordion",
            "Iframe removed from the DOM cleanly"
          ]
        ]
      },
      {
        "id": "TC-SET-004",
        "title": "Reset data: cancel path, confirm path, and URL parameter",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Create a marker lead first",
            "Exists in the list"
          ],
          [
            "Settings → Reset all data → Cancel",
            "Modal closes; the marker lead still exists"
          ],
          [
            "Reset again → \"Yes, reset everything\"",
            "Success toast; signed out to login"
          ],
          [
            "Log in; check leads and products",
            "Exactly 50 / 12; marker gone; deterministic values back"
          ],
          [
            "Create another marker; open /?reset=true",
            "Lands at login; the parameter is stripped from the URL"
          ],
          [
            "Log in",
            "Marker gone; seed state again"
          ],
          [
            "Verify session cleanliness",
            "No leftover toasts/state from before the reset"
          ]
        ]
      },
      {
        "id": "TC-SET-005",
        "title": "Feature: phone field validation formats",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Save profile with phone \"abc\"",
            "Rejected"
          ],
          [
            "\"123\" (too short)",
            "Rejected"
          ],
          [
            "\"+91 98123 45678\"",
            "Accepted"
          ],
          [
            "\"9812345678\" (bare digits)",
            "Accepted"
          ],
          [
            "\"+1-555-0100\" (dashes)",
            "Accepted"
          ],
          [
            "Empty phone",
            "Accepted (optional field)"
          ],
          [
            "Reload after a valid save",
            "Value persisted"
          ]
        ]
      },
      {
        "id": "TC-SET-006",
        "title": "Feature: reset confirmation modal gating",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Click \"Reset all data\"",
            "Confirmation modal opens — reset does NOT run yet"
          ],
          [
            "Press Escape",
            "Modal closes; nothing reset"
          ],
          [
            "Reopen; click the backdrop",
            "Same — cancel-safe"
          ],
          [
            "Reopen; click Cancel",
            "Same"
          ],
          [
            "Reopen; click \"Yes, reset everything\"",
            "Only now: toast, wipe, sign-out"
          ],
          [
            "Log in",
            "Seed state confirmed"
          ]
        ]
      },
      {
        "id": "TC-SET-007",
        "title": "Journey: personalization that survives sessions, then a clean wipe",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Set dark theme (topbar), Compact density, Push ON, and a new profile phone",
            "All applied"
          ],
          [
            "Log out; log in",
            "Theme, density, toggles, phone all intact"
          ],
          [
            "Close and reopen the browser (remembered session)",
            "Personalization persists"
          ],
          [
            "Trigger Reset all data (confirm)",
            "Signed out"
          ],
          [
            "Log in and inspect everything",
            "Theme/prefs/profile back to defaults — reset wipes personalization too"
          ],
          [
            "Set dark theme again",
            "Works cleanly post-reset"
          ],
          [
            "Reset via URL for the next suite",
            "Deterministic baseline"
          ]
        ]
      },
      {
        "id": "TC-SET-008",
        "title": "Journey: settings as the QA control room",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Before a \"test run\": use /?reset=true",
            "Known-good seed"
          ],
          [
            "Mid-run: consult the in-app help via the iframe FAQ for reset instructions",
            "Documentation accurate"
          ],
          [
            "Simulate a dirty run: mutate leads, deals, tickets",
            "Data changed"
          ],
          [
            "Use Settings → Reset (cancel first to prove intent gating)",
            "Cancel preserves; confirm wipes"
          ],
          [
            "Verify golden values after reset (first product SKU PRD-001, 50 leads)",
            "Deterministic assertions hold"
          ],
          [
            "Repeat the reset twice in a row",
            "Idempotent — same state every time"
          ]
        ]
      }
    ]
  },
  {
    "name": "App Chrome & Automation Traps",
    "cases": [
      {
        "id": "TC-CHR-001",
        "title": "Global search: thresholds, async states, grouped navigation for all entities",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Type a single character",
            "No dropdown (2-char minimum)"
          ],
          [
            "Type \"aar\"",
            "\"Searching…\" state first, then grouped results with type badges"
          ],
          [
            "Click a Lead result",
            "Leads list page opens"
          ],
          [
            "Search again; click a Contact result",
            "That contact’s DETAIL page"
          ],
          [
            "Repeat for an Account, a Product, and a Deal result",
            "Account detail / product detail / deal detail respectively; product entries show \"name (SKU)\""
          ],
          [
            "Search gibberish",
            "\"No results for …\" message"
          ],
          [
            "Clear the input",
            "Dropdown closes"
          ],
          [
            "Search while on any page",
            "Works identically from every module (topbar is global)"
          ]
        ]
      },
      {
        "id": "TC-CHR-002",
        "title": "Notifications: badge, unread styling, mark-all-read",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "On fresh seed check the bell",
            "Badge shows 3"
          ],
          [
            "Open the panel",
            "5 notifications; 3 unread highlighted with bolder styling"
          ],
          [
            "Read the timestamps",
            "Relative times (\"2d ago\" style)"
          ],
          [
            "Click \"Mark all read\"",
            "Badge disappears; highlighting removed"
          ],
          [
            "Verify the button state",
            "Now disabled"
          ],
          [
            "Close and reopen the panel",
            "State persisted"
          ],
          [
            "Reload the page",
            "Read state persisted in storage"
          ]
        ]
      },
      {
        "id": "TC-CHR-003",
        "title": "Theme and layout: dark mode everywhere, sidebar collapse, nav groups",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click the theme toggle",
            "Dark theme applies (verify computed backgrounds on the sidebar, a table, a card)"
          ],
          [
            "Navigate through 4 different pages",
            "Dark consistently applied, including modals and dropdowns"
          ],
          [
            "Reload",
            "Dark persisted"
          ],
          [
            "Collapse the sidebar via the hamburger",
            "Icons-only; navigation still works"
          ],
          [
            "Expand; collapse the \"Sales\" nav group",
            "Its items hide; other groups unaffected"
          ],
          [
            "Re-expand the group",
            "Items return"
          ],
          [
            "Toggle back to light",
            "Everything restores"
          ]
        ]
      },
      {
        "id": "TC-CHR-004",
        "title": "Overlay behaviors: toast stacking/dismissal and modal close paths",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Trigger three quick save actions",
            "Toasts stack vertically, newest below"
          ],
          [
            "Wait ~4.5 s",
            "They auto-dismiss in order"
          ],
          [
            "Trigger one and click its × immediately",
            "Closes instantly"
          ],
          [
            "Open any modal; press Escape",
            "Closes"
          ],
          [
            "Reopen; click the dark backdrop",
            "Closes"
          ],
          [
            "Reopen; click the × button",
            "Closes; page state unaffected each time"
          ],
          [
            "Open a dropdown inside a modal",
            "Layering correct (menu above modal)"
          ]
        ]
      },
      {
        "id": "TC-CHR-005",
        "title": "Shadow-DOM widget and the decoy-id trap",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Click the floating 💬 Feedback button",
            "Panel opens inside a shadow root; Submit DISABLED"
          ],
          [
            "Click the 4th star",
            "4 stars highlight; Submit enables"
          ],
          [
            "Type a comment; Submit",
            "\"Thanks for your feedback!\"; panel auto-closes ~2.5 s later"
          ],
          [
            "Reopen the widget",
            "State reset (no stars, submit disabled)"
          ],
          [
            "Inspect any input/button id",
            "Auto-generated id like el-x8k2f-3a"
          ],
          [
            "Record it; reload the page",
            "The recorded id no longer exists (new salt each load)"
          ],
          [
            "Relocate the same element by role/text/placeholder/testid",
            "Found reliably — the stable strategies survive"
          ]
        ]
      },
      {
        "id": "TC-CHR-006",
        "title": "Feature: toast anatomy per type and dismissal paths",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Trigger a success toast (any save)",
            "Green accent bar + ✓ icon + message"
          ],
          [
            "Trigger an error toast (invalid quick-add)",
            "Red accent + ✕ icon"
          ],
          [
            "Trigger an info toast (welcome or export)",
            "Blue accent + ℹ icon"
          ],
          [
            "Let one expire naturally",
            "Auto-dismisses ~4.5 s"
          ],
          [
            "Close one via ×",
            "Immediate"
          ],
          [
            "Stack three",
            "Vertical stack; each dismisses independently"
          ],
          [
            "Verify the container",
            "aria-live polite region with data-testid toast-container"
          ]
        ]
      },
      {
        "id": "TC-CHR-007",
        "title": "Feature: global search result grouping and per-type limits",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Search a broad term matching many records (\"a\")",
            "Below threshold — no dropdown until 2 chars"
          ],
          [
            "Search \"an\"",
            "Grouped results; leads ≤ 4, contacts ≤ 4, accounts ≤ 3, products ≤ 3, deals ≤ 3 per type"
          ],
          [
            "Verify each result’s type badge",
            "Lead/Contact/Account/Product/Deal labels correct"
          ],
          [
            "Verify product entries",
            "Formatted \"name (SKU)\""
          ],
          [
            "Search an exact SKU",
            "Product found via SKU matching"
          ],
          [
            "Select a result",
            "Dropdown closes AND the query clears"
          ]
        ]
      },
      {
        "id": "TC-CHR-008",
        "title": "Feature: dark theme variable application across component types",
        "tags": [
          "Feature",
          "Regression"
        ],
        "steps": [
          [
            "Enable dark theme; inspect the computed background of the page body",
            "Dark token applied"
          ],
          [
            "Check a table, a modal, a dropdown menu, and a toast",
            "All use dark surface tokens (no white flashes)"
          ],
          [
            "Check pill/badge contrast",
            "Text remains readable (brightness filter applied)"
          ],
          [
            "Check the login page (logged out)",
            "Theme persists pre-auth"
          ],
          [
            "Check the iframe help center",
            "Iframe keeps its own light document (independent context) — expected"
          ],
          [
            "Toggle back to light",
            "Every surface restores"
          ]
        ]
      },
      {
        "id": "TC-CHR-009",
        "title": "Journey: cross-cutting resilience run (search → theme → widget → traps)",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Search-navigate a chain: lead result → product result → account result → deal result",
            "Four correct landings in a row from the global search"
          ],
          [
            "Mid-flow, switch to dark theme",
            "Current page and all subsequent pages render dark"
          ],
          [
            "Submit feedback via the shadow-DOM widget",
            "Full gated cycle works under dark theme"
          ],
          [
            "Capture 3 element ids across different pages; reload; recheck",
            "All three dead — trap consistent app-wide"
          ],
          [
            "Re-run one search navigation using only role/text locators",
            "Works — proving the intended strategy"
          ],
          [
            "Check the console across the whole run",
            "Zero errors"
          ],
          [
            "Reset and log out",
            "Clean exit"
          ]
        ]
      },
      {
        "id": "TC-CHR-010",
        "title": "Journey: customer-360 lookup — one name to full context",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "A caller says \"I’m Meera from Silverline\": global search \"Meera\"",
            "Contact suggestion appears after the async state"
          ],
          [
            "Open the contact; read notes and activity tabs",
            "Context gathered"
          ],
          [
            "Follow the account link to Silverline Bank",
            "Account detail; related deals accordion"
          ],
          [
            "Open the active deal from the inner accordion",
            "Deal detail with amount/stage"
          ],
          [
            "Back via breadcrumbs to the contact; add a note recording the call",
            "Note saved; activity updated"
          ],
          [
            "Global search \"Silverline\"",
            "Account and deal reachable — the web of links is navigable both ways"
          ],
          [
            "Log the interaction time",
            "Entire lookup possible without touching the sidebar once"
          ]
        ]
      }
    ]
  },
  {
    "name": "Edge & Environment",
    "cases": [
      {
        "id": "TC-EDGE-001",
        "title": "Responsive: the app remains usable at mobile viewport (375×812)",
        "tags": [
          "Smoke",
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Resize the browser to 375×812 (or use device emulation); log in",
            "Login card fits without horizontal page scroll"
          ],
          [
            "Open the Dashboard",
            "Stat tiles stack; charts fit; dashboard grid collapses to one column"
          ],
          [
            "Open Leads",
            "Table scrolls horizontally INSIDE its container — the page body never scrolls sideways"
          ],
          [
            "Open Deals",
            "Kanban columns scroll horizontally within the board"
          ],
          [
            "Open a modal (any create/delete dialog)",
            "Modal fits the viewport with internal scrolling"
          ],
          [
            "Collapse/expand the sidebar",
            "Navigation usable at narrow width"
          ],
          [
            "Use the global search and its dropdown",
            "Dropdown fits and is tappable"
          ],
          [
            "Restore desktop size",
            "Layout returns to multi-column without artifacts"
          ]
        ]
      },
      {
        "id": "TC-EDGE-002",
        "title": "Hostile input: long strings, HTML-like text, emoji, RTL",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Create a lead named with 300 characters",
            "Accepted; list/detail render without breaking the layout (truncation or wrap, no overflow)"
          ],
          [
            "Create a contact named \"<script>alert(1)</script>\"",
            "Rendered as literal text everywhere (list, detail, search results) — NO script execution, no broken markup"
          ],
          [
            "Create a product named with emoji \"🚀 Rocket Plan 🚀\"",
            "Renders correctly in list, detail, dropdowns, and global search"
          ],
          [
            "Create an account named in RTL text \"شركة الاختبار\"",
            "Displays correctly; row click, edit, and delete still work"
          ],
          [
            "Search each hostile record via global search",
            "All findable; dropdown renders them safely"
          ],
          [
            "Export leads CSV containing the long/HTML names",
            "File remains well-formed; cells quoted properly"
          ],
          [
            "Delete all hostile records",
            "Clean removal; no residue in any list"
          ]
        ]
      },
      {
        "id": "TC-EDGE-003",
        "title": "Multi-tab behavior: shared storage without live sync (known characteristic)",
        "tags": [
          "Regression"
        ],
        "steps": [
          [
            "Log in; open the app in a second browser tab",
            "Second tab shares the session (same localStorage)"
          ],
          [
            "In tab A create a lead",
            "Tab A shows it"
          ],
          [
            "Switch to tab B without reloading",
            "Lead NOT visible yet — no cross-tab live sync (expected characteristic)"
          ],
          [
            "Reload tab B",
            "Lead appears (storage is shared at read time)"
          ],
          [
            "In tab B delete that lead; in tab A (stale) open its detail from the old list",
            "\"Lead not found.\" handled gracefully — no crash"
          ],
          [
            "Reload tab A",
            "Lists consistent again"
          ],
          [
            "Document the takeaway",
            "Automation must not assume cross-tab reactivity; single-tab flows only"
          ]
        ]
      },
      {
        "id": "TC-EDGE-004",
        "title": "Browser history: back/forward through lists, details, and forms",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Navigate Leads → a lead detail → Edit mode → breadcrumb back → Products → a product detail",
            "Each navigation lands correctly"
          ],
          [
            "Press Back",
            "Products list"
          ],
          [
            "Press Back again",
            "Leads list (edit mode was in-page state, not a history entry)"
          ],
          [
            "Press Forward twice",
            "Returns along the same chain"
          ],
          [
            "Apply a search on Leads; open a detail; press Back",
            "List loads again (note: search text does NOT persist — in-memory state; document as expected)"
          ],
          [
            "Deep-link a detail URL in a fresh tab",
            "Loads directly with data fetched by id"
          ],
          [
            "Back from a form page (/leads/new) after typing",
            "Leaves without a blocker; typed data discarded (no draft persistence — expected)"
          ]
        ]
      },
      {
        "id": "TC-EDGE-005",
        "title": "Accessibility: roles, names, and keyboard reachability of core controls",
        "tags": [
          "Sanity",
          "Regression"
        ],
        "steps": [
          [
            "Inspect every icon-only button (bell, theme, sidebar toggle, password eye, task delete)",
            "Each has an aria-label (accessible name)"
          ],
          [
            "Inspect custom selects",
            "Trigger has aria-haspopup/expanded; menu has role=listbox; options role=option with aria-selected"
          ],
          [
            "Inspect tabs on a contact detail",
            "role=tablist/tab with aria-selected on the active tab"
          ],
          [
            "Inspect a modal",
            "role=dialog with aria-modal and an accessible label"
          ],
          [
            "Tab through the login form with the keyboard only",
            "All fields and the submit reachable; Enter submits"
          ],
          [
            "Toggle an admin switch with the keyboard (Space)",
            "Operable without a mouse"
          ],
          [
            "Check toast container",
            "aria-live region announces new toasts"
          ]
        ]
      },
      {
        "id": "TC-EDGE-006",
        "title": "Chart internals: SVG structure and hover titles",
        "tags": [
          "Regression"
        ],
        "steps": [
          [
            "Inspect the dashboard bar chart SVG",
            "One rect per stage; each rect contains a <title> \"Stage: count\""
          ],
          [
            "Hover a bar",
            "Native tooltip shows the title text"
          ],
          [
            "Inspect the donut",
            "One circle segment per status with <title> \"Status: count\"; center text = total"
          ],
          [
            "Inspect the line chart",
            "Polyline + one circle per month, each with <title> \"Mon: value\""
          ],
          [
            "Cross-check two title values against real data",
            "Counts accurate"
          ],
          [
            "Switch the date range",
            "Titles update with the data"
          ]
        ]
      },
      {
        "id": "TC-EDGE-007",
        "title": "Journey: hostile data survives a full application tour",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Create a lead, product, contact, and account each with hostile names (HTML tags, 200+ chars, emoji)",
            "All created via their form pages"
          ],
          [
            "Link them: lead ← product, contact ← account",
            "Associations work with hostile names"
          ],
          [
            "Tour every surface: lists, details, kanban (create a deal for the hostile account), global search, dashboard",
            "Every surface renders the names as inert text; nothing breaks"
          ],
          [
            "Convert the hostile lead through the wizard",
            "Wizard previews and creates records with the names intact"
          ],
          [
            "Export CSV and inspect",
            "File parses; hostile cells quoted/escaped"
          ],
          [
            "Delete everything created, honoring each guard",
            "Type-name gate works even with emoji/HTML names (exact-match typing)"
          ],
          [
            "Reset data",
            "Environment clean"
          ]
        ]
      },
      {
        "id": "TC-EDGE-008",
        "title": "Journey: the grand reset guarantee across every module at once",
        "tags": [
          "E2E"
        ],
        "steps": [
          [
            "Reset; snapshot golden values (50 leads, 12 products, first product SKU PRD-001, pipeline $ total, 5 users)",
            "Baseline recorded"
          ],
          [
            "Mutate EVERY module: +lead, +product, +contact, +account, +deal (moved to Won), task completed, ticket closed, user added, profile renamed, theme dark",
            "Ten mutations across ten modules"
          ],
          [
            "Settings → Reset all data → Cancel",
            "ALL ten mutations still present (cancel is truly safe)"
          ],
          [
            "Reset → Confirm",
            "Signed out"
          ],
          [
            "Log in and verify every module against the golden snapshot",
            "Every count and value restored exactly; user list back to 5; profile name back; theme back to light"
          ],
          [
            "Repeat the whole cycle once more",
            "Identical results — reset is idempotent and total"
          ],
          [
            "Verify via ?reset=true as the alternate path",
            "Same guarantee"
          ]
        ]
      }
    ]
  }
] as CatalogModule[];
