# PR7 Staff Scope and Dashboard Implementation Plan

> **For agentic workers:** Execute the approved plan task by task. Use tests-first steps as written; keep PR7a and PR7b separate and under approximately 400 changed lines each.

**Goal:** Remove Staff hotel/restaurant property pages, expose Rooms and Tables navigation, and make Staff dashboard/report data correctly scoped while showing each resource status accurately.

**Architecture:** PR7a handles Staff navigation/pages, the Staff logo, and assigned-restaurant listing scope. PR7b handles dashboard/report scope and availability metrics, using request-aware services and a focused Staff dashboard component extracted from `App.tsx`.

**Tech stack:** Express 5, TypeScript, Supabase/PostgREST, React 19, React Router 7, Vite, Node built-in test runner.

**Approved scope:** N5 + N7, H17, H21, H22, H26. Preserve all Admin and Customer routes and current booking actions/detail/history. Apply SRP/OCP refactoring only where touched code benefits from it. G6 applies to each PR. G4 requires an explicit LSP/ISP check.

## Global constraints

- Staff may view/manage all rooms and room reservations, but only assigned restaurants/tables and their reservations.
- Admin and Customer behavior remains available; public hotel/restaurant browse routes remain intact.
- Do not change booking rules, API contracts, RLS policy, cookie-session design, or the service-role boundary.
- Preserve existing reservation actions and detail/history behavior.
- Keep each PR below approximately 400 changed lines; split further if needed. Report plan/documentation line count separately from code and tests.
- Add regression tests before production changes; confirm the new tests fail first. Do not weaken existing tests.
- Apply the approved G6 review checklist to both PRs. Formatting and syntax checks remain CI responsibilities.

## Approved item-to-task mapping

| Item | Task mapping |
| --- | --- |
| N5 | PR7a Task 1: remove Staff property pages and add Rooms/Tables. PR7a Task 2: preserve assigned restaurant-list scope for API callers that still use the endpoint. |
| H26 | PR7a Task 1: correct the Staff logo underline. |
| H17 | PR7a Task 2: scope `GET /api/restaurants` to the requesting Staff member's assigned restaurants. |
| H21 | PR7b Tasks 3–5: test and align Admin/Staff room occupancy using the same occupancy report. |
| H22 | PR7b Tasks 3–4: test and enforce role/assignment scope for dashboard and occupancy/reservation reports. |
| N7 | PR7b Tasks 3–5: test, count, and render every room/table status separately. |

## Review focus and data rules

1. Staff with no restaurant assignments sees no restaurant/table rows or counts while retaining hotel-room and room-reservation access.
2. Staff with multiple assignments sees data for those restaurants only.
3. Admin and Staff room occupancy use the same calculation for the same room reservation data.
4. Customer discovery continues to list hotels and restaurants after Staff property pages are removed.
5. Direct Staff navigation to removed property paths redirects safely; Admin property settings and inventory remain available.
6. Count Available, Reserved, Occupied, and Maintenance directly by status. Never infer Reserved as total minus Available when other statuses exist. Test explicitly that Maintenance is not counted as Reserved; display other statuses separately.

## File map

### PR7a — Staff navigation and restaurant list scope

- Modify `frontend/src/App.tsx`: retain Customer and Admin routes; delegate Staff navigation to the extracted shell; redirect Staff from `/properties`, `/hotels`, `/restaurants`, and Staff property details.
- Create `frontend/src/components/StaffLayout.tsx`: extract Staff shell/navigation from `App.tsx` for clearer responsibility boundaries (SRP).
- Create `frontend/src/staffNavigation.ts`: declarative Staff navigation and account links, excluding property pages.
- Create `frontend/tests/staffNavigation.test.ts`: cover Staff navigation and route redirect policy.
- Modify `frontend/src/styles.css`: correct the Staff logo underline without changing other role branding.
- Modify `src/controllers/restaurant.controller.ts` and `src/services/restaurant.service.ts`: pass optional-auth request context and restrict authenticated Staff list responses to assigned restaurant IDs.
- Create `tests/restaurant-list-scoping.test.mjs`: cover public, Customer, Admin, assigned Staff, and zero-assignment Staff results.
- Modify `src/routes/restaurant.routes.ts` only if the existing optional-auth route needs adjustment; preserve public GET access.

### PR7b — Dashboard/report scope and availability

- Modify `src/controllers/dashboard.controller.ts` and `src/services/dashboard.service.ts`: pass request context, preserve all-room access, and scope Staff restaurant/table and restaurant-reservation aggregates to assignments.
- Modify `src/controllers/report.controller.ts` and `src/services/report.service.ts`: pass request context into occupancy calculation; retain Staff restaurant/table report scoping.
- Create `frontend/src/components/StaffDashboardPage.tsx`: render direct status counts and shared room occupancy without Admin-only data.
- Modify `frontend/src/App.tsx`: route Staff dashboard rendering through the focused component (SRP extraction).
- Create `tests/dashboard-scoping.test.mjs`: cover Admin totals, Staff all-room counts, assigned-table counts, and zero-assignment behavior.
- Extend `tests/report-scoping.test.mjs`: cover shared room occupancy and Staff assignment-scoped reports.
- Create `frontend/tests/staffDashboard.test.ts`: cover direct status counts, maintenance, unknown statuses, and empty inventory.

---

## PR7a tasks

### Task 1 — Staff navigation and route behavior

**Files:**

- Create `frontend/tests/staffNavigation.test.ts`.
- Create `frontend/src/staffNavigation.ts`.
- Create `frontend/src/components/StaffLayout.tsx`.
- Modify `frontend/src/App.tsx` and `frontend/src/styles.css`.

**Steps:**

1. Add failing tests that Staff navigation contains `/dashboard`, `/rooms`, `/tables`, `/reservations`, and `/manage`, and omits `/properties`, `/hotels`, and `/restaurants`.
2. Test account links `/notifications` and `/profile`.
3. Add failing tests for redirects from `/properties`, `/hotels`, `/restaurants`, `/hotels/:id`, and `/restaurants/:id` to `/dashboard`; retained Staff paths have no redirect.
4. Run `npm --prefix frontend test`; confirm the new assertions fail against the current navigation/routes.
5. Extract Staff shell and declarative link definitions. Preserve sign-out, profile, notifications, session warning, and all current reservation actions/history.
6. Apply redirects only for Staff. Keep Customer hotel/restaurant discovery and detail routes; keep Admin property management and inventory routes.
7. Correct the Staff logo underline selector without changing Admin/Customer branding.
8. Run frontend tests and `npm --prefix frontend run typecheck`.
9. Review the code/test diff against G6 and keep PR7a below approximately 400 changed lines, excluding plan/documentation lines in the reported implementation count.

### Task 2 — Staff restaurant-list authorization scope

**Files:**

- Create `tests/restaurant-list-scoping.test.mjs`.
- Modify `src/controllers/restaurant.controller.ts` and `src/services/restaurant.service.ts`.
- Modify `src/routes/restaurant.routes.ts` only if needed.
- Modify `tests/restaurant-assignment-scope.test.mjs` only if shared request/access fixtures materially reduce duplication.

**Steps:**

1. Add failing tests: public requests return the full public list; Customer and Admin lists remain unfiltered; Staff receives only assigned restaurant IDs; Staff with no assignments receives `200 []` and does not issue an empty `in.()` query.
2. Run `npm run build`, then `node --test tests/restaurant-list-scoping.test.mjs`; confirm Staff cases fail against the unscoped implementation.
3. Pass the request through controller/service. Use `getAssignedRestaurantIds(req)` and the request-scoped Supabase client for both assignment lookup and Staff restaurant querying.
4. Never use the session-store service-role client for business-data listing. Keep public/Customer/Admin list behavior as before.
5. Run the focused test, existing restaurant-assignment and public-browse tests, then `npm test`.
6. Review the code/test diff against G6 and keep PR7a below approximately 400 changed lines, excluding documentation from the separately reported implementation count.

---

## PR7b tasks

### Task 3 — Dashboard/report regression tests first

**Files:** create `tests/dashboard-scoping.test.mjs`, extend `tests/report-scoping.test.mjs`, create `frontend/tests/staffDashboard.test.ts`, and create the tested dashboard model/component as planned for Task 5.

1. Add failing backend tests for Admin-wide totals; Staff all-room totals; Staff restaurant/table totals limited to assignments; and zero-assignment Staff behavior.
2. Add failing report tests showing identical Admin/Staff room occupancy for identical room reservation data, while Staff restaurant/table reports remain assignment-scoped.
3. Add failing frontend model tests for direct Available, Reserved, Occupied, and Maintenance counts; independent room/table counts; unknown statuses; and empty inventory.
4. Assert Maintenance is never counted as Reserved and Reserved is never calculated as total minus Available.
5. Run targeted backend and frontend tests; confirm new cases fail before production changes.

### Task 4 — Request-aware dashboard and report queries

**Files:** modify `src/controllers/dashboard.controller.ts`, `src/services/dashboard.service.ts`, `src/controllers/report.controller.ts`, `src/services/report.service.ts`, and the new/extended scope tests.

1. Pass authenticated `Request` from the dashboard controller into the service.
2. Keep Staff room totals global, consistent with Staff-wide room permission; calculate each room status individually.
3. Derive Staff restaurant IDs once, then scope restaurant/table and restaurant-reservation aggregates; keep Admin-wide totals and Staff hotel reservations available.
4. Pass request context into occupancy reporting. Admin and Staff use the same room-occupancy calculation.
5. Ensure reservation/table reports keep hotel reservations available to Staff and filter restaurant reservations by assigned table IDs.
6. Keep business-data access request-scoped and preserve safe error responses.
7. Run dashboard/report tests and verify service-role isolation.

### Task 5 — Staff dashboard availability UI and responsibility split

**Files:** create `frontend/src/components/StaffDashboardPage.tsx` and `frontend/tests/staffDashboard.test.ts`; modify `frontend/src/App.tsx`.

1. Implement the tested dashboard model and render Available, Reserved, Occupied, and Maintenance counts for rooms and tables directly from each status.
2. Never derive Reserved by subtracting Available from Total.
3. Load `/reports/occupancy` alongside `/dashboard` and render its room occupancy rate using the shared Admin/Staff calculation; distinguish reservation occupancy from inventory status counts.
4. Extract Staff dashboard rendering/data orchestration from `App.tsx`; retain route selection in `App.tsx`.
5. Use declarative resource-card descriptors so adding a resource does not require duplicating resource-specific render branches (small OCP application).
6. Keep Admin revenue and registered-user data out of the Staff component.
7. Run targeted frontend tests/typecheck, then applicable full backend/frontend suites and production builds.
8. Review the combined PR7b code/test diff against G6 and keep it below approximately 400 changed lines, reporting documentation separately.

## Acceptance criteria

- Staff navigation has Dashboard, Rooms, Tables, Reservations, Manage, Notifications, and Profile; no Hotels, Restaurants, or Hotels & Restaurants entry.
- Direct Staff property-list/detail routes redirect to Dashboard. Customer discovery/details and Admin property management still work.
- Staff restaurant list, table metrics, and restaurant reports include only assigned restaurants; empty assignment lists return safe empty data.
- Staff retains access to all room and room-reservation data.
- Admin and Staff room occupancy use the same calculation; Staff restaurant data remains assignment-scoped.
- Staff dashboard shows direct Available, Reserved, Occupied, and Maintenance counts for rooms and tables.
- Existing booking actions and detail/history behavior are preserved.
- Each PR has targeted tests, full applicable suite/build/typecheck evidence, G4 LSP/ISP review, and G6 self-review.

## G4 LSP/ISP check

- **LSP:** Do not introduce a DashboardDataSource inheritance hierarchy for this work. Verify that the shared `/reports/occupancy` contract means the same thing for Admin and Staff; only role-authorized restaurant data may differ. If multiple data-source implementations are introduced, add contract tests that run against each implementation.
- **ISP:** Keep the Staff dashboard dependent only on its dashboard payload and occupancy report. It must not require Admin-only revenue or registered-user data. Do not create a broad role-dashboard interface to support this screen.

## G6 self-review gate

For each PR, answer yes/no and provide evidence for every approved checklist item: 20+ verifiable items, at least five per category, weighted Logic & Control Flow 35%, Input Validation/Security 25%, Resource Management 20%, Maintainability 20%, with weighting rationale. Explicitly inspect role/RLS scope (H17/H20/H22), CSRF and cookie behavior, response token secrecy, service-role isolation, date validation (H27), status transitions (H23), failure cleanup, component cohesion, and zero-assignment/partial-failure tests. Keep code/test PRs within 200–400 lines; report documentation separately. Request review within 24 hours and use constructive code-focused language. Leave formatting/syntax enforcement to CI.

## Plan self-review

- N5, N7, H17, H21, H22, H26 are mapped to tasks above.
- Reserved-count behavior and the Maintenance regression case are explicit.
- G4 LSP/ISP checks are included.
- PR7a and PR7b are separate; split further if either code/test diff exceeds the agreed limit.
- Database migrations, RLS changes, combined-booking scoping (H20), and Admin booking merges (PR8) are outside this plan.
