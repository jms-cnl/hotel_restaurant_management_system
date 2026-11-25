# PR6c + A20 Customer Experience Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement each sub-PR. Follow tests-first steps and keep each code/test diff below approximately 400 changed lines.

**Goal:** Present Maison Valment as one coherent customer destination and polish combined booking, profile, notifications, and login flows.

**Architecture:** Keep the existing React routes, customer components, Express APIs, and cookie session. Refine customer-facing composition and styling in small PRs, reusing existing data endpoints and booking payloads. Do not introduce endpoints, columns, or booking rule changes.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite, Node built-in test runner, CSS, Express BFF, Supabase.

**Spec:** User request in the task description (PR6c + A20 scope).

## Global Constraints

- Customer-only presentation and interaction work; do not change API contracts, booking rules, RLS, or cookie-session design.
- System represents one hotel: Maison Valment. Use existing API data; do not hardcode database IDs.
- Keep every existing customer and manager route behind its current `Protected` boundary; route access is outside the approved 6c-1 scope.
- Combined stay selects exactly one room and one table for the same hotel; backend already enforces this rule.
- Tests first for every implementation change; add a failing regression test before production code.
- OCP means an interface plus polymorphic classes, not data arrays. Do not introduce generic arrays of UI records as an OCP substitute.
- Keep every implementation sub-PR below approximately 400 changed lines, including tests and styles.
- Do not push any sub-PR branch. Commit only when the user explicitly requests it.

## Review Focus

1. `/hotels` and home must lead to the single Maison Valment property experience without hotel-directory wording or location filters; empty/error states must remain clear.
2. Rooms, restaurants, and amenities remain reachable from the one hotel experience; preserve direct detail routes and existing API use.
3. Combined booking UI offers one room and one table, and backend remains the authority for same-hotel validation; preserve payload and date/time validation.
4. Customer profile tabs and stats must behave with empty, failed, and populated reservation responses without changing profile/password APIs.
5. Login, notifications, and combined booking cards remain readable and usable at narrow widths, including error, unread/read, and long-content states.

---

## File Map and Sub-PR Estimates

Estimates are changed lines (additions plus deletions) for implementation source, tests, and CSS; documentation is excluded. Re-estimate after tests are drafted and split further if any PR approaches 400.

### PR6c-1 — Single-establishment discovery

- Modify `frontend/src/components/CustomerHome.tsx` (~70 lines): replace multi-hotel discovery framing with a single-property entry point; remove location state/filter and directory heading; retain search/availability only where they still make sense.
- Modify `frontend/src/components/HotelDiscovery.tsx` (~55 lines): remove the hotel catalog listing and location filter; resolve `/hotels` to the sole property detail using the existing hotel-list response, preserving loading/error/empty states.
- Modify `frontend/src/components/RestaurantDiscovery.tsx` (~45 lines): remove location filter and directory language while keeping restaurant/table availability browse behavior.
- Modify `frontend/src/customer-theme.css` (~20 lines): adjust single-property discovery spacing and responsive layout only if needed.
- Create `frontend/tests/customerSingleEstablishment.test.ts` (~75 lines): assert no customer “Explore Places to Stay”/hotel-directory copy or location control; verify the existing protected route wrapper and manager routing remain intact.
- **Estimated diff:** ~265 lines.

### PR6c-2 — One property page with rooms, restaurants, and amenities

- Modify `frontend/src/components/HotelDetails.tsx` (~75 lines): make this the canonical Maison Valment page and include its restaurant offerings alongside existing rooms and amenities, using current hotel/restaurant/media/amenity endpoints.
- Modify `frontend/src/components/RestaurantDiscovery.tsx` (~15 lines): ensure customer restaurant links return to the hotel experience and avoid implying multiple locations.
- Modify `frontend/src/customer-theme.css` (~45 lines): style the restaurant section within the hotel detail composition and its mobile layout.
- Create `frontend/tests/customerPropertyPage.test.ts` (~65 lines): assert the property page loads rooms, restaurants, amenities through existing paths and retains loading, unavailable, and empty states.
- **Estimated diff:** ~200 lines.

### PR6c-3 — Combined-stay wizard and card spacing

- Modify `frontend/src/components/CustomerCombinedBookings.tsx` (~120 lines): organize the current form into explicit wizard steps/review while selecting exactly one room and one table; use the single-establishment context and preserve `buildCombinedBookingPayload`, existing validation, and endpoint.
- Create `frontend/src/combinedWizardSteps.ts` (~55 lines net): define a `WizardStep` interface and polymorphic `RoomStep`, `TableStep`, and `ReviewStep` classes so each step owns its label, completion rule, and view. Keep the orchestrator independent of concrete step behavior.
- Modify `frontend/src/customer-theme.css` (~75 lines): add wizard progress/review styling and increase/normalize spacing inside combined booking cards and child rows, including responsive rules.
- Create `frontend/tests/customerCombinedWizard.test.ts` (~100 lines): prove one selected room and one selected table are submitted, payload shape is unchanged, step progression requires its selection, review shows the chosen items, and success/error paths remain available.
- Extend `frontend/tests/customerData.test.ts` (~20 lines) only if a pure helper is needed for wizard step eligibility; test exact 1-room + 1-table payload behavior without duplicating backend same-hotel validation.
- **Estimated diff:** ~370 lines including the proposed wizard interface/classes; keep the total below 400, otherwise defer the classes to Step 10 and retain explicit step behavior.

### PR6c-4 — Customer profile tabs and stats

- Modify `frontend/src/App.tsx` (~75 lines): extend the current profile tab presentation to customer accounts and derive profile stats from existing customer reservation data; keep existing profile update/password requests and manager behavior.
- Create `frontend/src/customerProfile.ts` (~45 lines) only for typed, deterministic stat derivation from existing reservation records; do not add parallel data models or generic UI arrays.
- Create `frontend/tests/customerProfile.test.ts` (~65 lines): cover no reservations, hotel/table reservation counts, upcoming/completed status handling, and unavailable reservation data.
- Modify `frontend/src/customer-theme.css` (~45 lines): ensure profile overview, stats, tabs, and panels work for customer role at desktop and mobile widths.
- **Estimated diff:** ~230 lines.

### PR6c-5 — Notifications and login styling

- Modify `frontend/src/App.tsx` (~25 lines): apply a focused customer notifications presentation wrapper/classes while preserving `/notifications`, `/notifications/:id/read`, and role-specific notification rendering.
- Modify `frontend/src/components/CustomerLayout.tsx` (~10 lines): add accessible active/unread presentation hooks only if existing markup lacks them; do not add notification APIs or polling.
- Modify `frontend/src/customer-theme.css` (~90 lines): polish customer notification list/read states and login form visual hierarchy, focus states, and responsive sizing.
- Create `frontend/tests/customerAccountStyling.test.ts` (~70 lines): structural regression checks that login labels/autocomplete/error semantics and customer notification read actions remain present with styling hooks.
- **Estimated diff:** ~195 lines.

## Test-First Execution Tasks

For each sub-PR, first add the named test file/assertions, run the targeted test and confirm the new assertion fails against current `main`, then make the smallest implementation change and rerun that test. Finish each PR with the complete frontend test suite and `npm.cmd --prefix frontend run typecheck`. Do not weaken existing assertions.

### PR6c-1 tests to write first

- In `customerSingleEstablishment.test.ts`, assert customer discovery source no longer renders “Explore Places to Stay”, “HOTEL DIRECTORY”, a multi-hotel count, or a location selector.
- Assert the existing protected route wrapper and Staff/Admin route handling remain unchanged.
- Assert restaurant discovery has no location selector and retains search and availability controls.

### PR6c-2 tests to write first

- In `customerPropertyPage.test.ts`, assert the hotel detail page requests/loads rooms, restaurants, and amenities from existing endpoints and displays each section.
- Cover hotel load failure, empty restaurant list, and amenities unavailable state so one failed section does not hide the others.

### PR6c-3 tests to write first

- In `customerCombinedWizard.test.ts`, assert a single room and a single table are required before review/submit and the existing endpoint receives the unchanged nested payload.
- Assert exactly one room and one table are represented in the review; preserve checkout-after-check-in and end-after-start validation.
- Assert wizard and card markup uses responsive spacing hooks; include an overlong venue/room label case if rendering-level coverage is available.

### PR6c-4 tests to write first

- In `customerProfile.test.ts`, test derived counts for zero, upcoming, completed, hotel, and restaurant reservations, including combined child records without double counting.
- Add a customer profile structural assertion for Profile Info and Change Password tabs, stats labels, loading/unavailable data state, and unchanged update/password API paths.
- Verify manager profile tabs remain unchanged.

### PR6c-5 tests to write first

- In `customerAccountStyling.test.ts`, assert login accessible names, autocomplete values, alert semantics, and submit action remain intact.
- Assert customer notifications keep title/message/date/read state and the mark-read action; CSS hooks cover read and unread presentation and narrow screens.
- Verify staff/admin notification rendering and notification API paths remain intact.

## OCP Opportunity

No OCP classes are needed in PR6c-1, PR6c-2, PR6c-4, or PR6c-5. For PR6c-3, wizard steps are a plausible OCP seam: the plan proposes a `WizardStep` interface with polymorphic `RoomStep`, `TableStep`, and `ReviewStep` classes. The estimate is approximately 370 changed lines including tests and styling; if measurement exceeds 400, defer this extraction to Step 10. Do not substitute data arrays for polymorphism.

## Backend Changes / Risks

- **Backend changes required by the requested scope: none.** Reuse existing hotel, restaurant, room, table, amenity, reservation, and notification endpoints.
- Flag any mismatch between the current API data shape and the assumed single hotel/restaurant association before implementation; do not add a column or endpoint in these PRs.
- The current `RestaurantTable` shape exposes restaurant identity while the `Restaurant` shape does not expose a hotel foreign key. Keep same-hotel enforcement on the existing backend; do not invent a client-side association or change the request contract.
- Profile stats depend on existing reservation response fields and may need a clear unavailable state if the API request fails; do not introduce a new stats endpoint.

## Deferred / needs decision

- Public browsing remains deferred. Routes stay behind `Protected` in all 6c sub-PRs. Supporting unauthenticated browsing would also require reviewing backend media routes, which currently require authentication for reads; that is a backend scope change and needs a separate decision.
