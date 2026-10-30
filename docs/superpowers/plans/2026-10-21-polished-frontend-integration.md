# Polished Frontend Integration Implementation Plan

> **For agentic workers:** Follow this plan task by task. Keep the existing backend API contracts as the source of truth.

**Goal:** Integrate the colleague-built polished customer UI into the Netlify frontend and connect its customer flows to the existing HRM backend.

**Architecture:** Port the visual components from `origin/frontend-pages:reservation-system` into the existing `frontend/` app. Retain the current API client, auth provider, routes and Admin/Staff management experience; replace prototype session flags, mock listings and fake reservation state with live backend operations.

**Tech Stack:** React 19, TypeScript, Vite, React Router 7, existing Express API and Supabase backend.

**Spec:** `docs/superpowers/specs/2026-10-21-polished-frontend-integration-design.md`

## Global Constraints

- The frontend build stays in `frontend/` and uses `VITE_API_BASE_URL`.
- Keep `frontend/src/api.ts`, `frontend/src/auth.tsx`, the HttpOnly cookie-session flow, CSRF handling, route guards, password recovery, and backend contracts as the source of truth. Do not add bearer-token or browser-storage token handling.
- Customer, Staff, and Admin can create reservations and combined bookings; only Staff and Admin can change reservation status.
- Show loading, empty, success, and API error states; do not fall back to mock records.
- Resource routes require authentication, so discovery remains behind the existing sign-in gate.
- Display only backend-provided fields; do not invent ratings, amenities, restaurant prices, or date availability.
- Do not change database schema, Supabase RLS policies, backend permissions, or deployment configuration.
- Do not commit, push, or deploy without explicit user authorization.

## Review Focus

- Unauthenticated access to booking/account routes redirects to the real login flow; test by opening a protected route without a valid session cookie.
- Auth success/failure uses the backend session; test invalid credentials and valid account sign-in without setting prototype session flags.
- Empty or failed resource reads never show prototype sample listings; test empty API data and a failed API request.
- Reservation creation is persisted through API and respects permissions; test customer create and verify customer status controls are absent.
- Recovery links exchange Supabase link tokens through the backend, remove them from the URL, and do not persist them in the browser; test the complete flow only with a fresh recovery link after user testing is scheduled.

---

### Task 1: Adapt the polished shared shell and navigation

**Files:**
- Create: `frontend/src/components/CustomerLayout.tsx`
- Create: `frontend/src/components/CustomerHome.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Copy/adapt visual assets from `origin/frontend-pages:reservation-system/{App.css,hero.png,icons.svg}` into `frontend/src/assets/`

**Interfaces:**
- Consumes: existing `AuthProvider`, `useAuth()`, React Router, and role-aware route structure.
- Produces: polished customer layout and customer home/discovery routes; preserves existing Admin/Staff shell and routes.

- [ ] Review the colleague prototype's design assets and list every hard-coded listing, demo auth flag, and sample booking to replace.
- [ ] Build the customer shell with responsive navigation, current-user state, logout, and links to existing customer routes.
- [ ] Apply the polished visual system without removing Admin/Staff route access or existing screens.
- [ ] Verify the protected-route unauthenticated case redirects to the existing login route.

### Task 2: Connect hotel and restaurant discovery/details to backend data

**Files:**
- Create: `frontend/src/components/HotelDiscovery.tsx`
- Create: `frontend/src/components/RestaurantDiscovery.tsx`
- Create: `frontend/src/components/HotelDetails.tsx`
- Create: `frontend/src/components/RestaurantDetails.tsx`
- Create: `frontend/src/customerData.ts` (pure display/search helpers)
- Create: `frontend/tests/customerData.test.ts`
- Modify: `frontend/package.json` to add the built-in Node test command if required
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/types.ts` only if response fields require safe optional typing
- Reuse: `frontend/src/api.ts`, `frontend/src/styles.css`

**Interfaces:**
- Consumes: `apiGet<T>()`; existing `Hotel`, `Restaurant`, `Room`, `RestaurantTable`, and `Media` types.
- Produces: authenticated discovery/detail views loaded from `/hotels`, `/restaurants`, `/rooms`, `/tables`, and `/media` API routes. Filter rooms by `hotel_id` and tables by `restaurant_id` on the client because those routes do not accept parent IDs.

- [ ] Implement hotel and restaurant search/filter against returned records; remove fabricated static records and fake ratings/prices that do not exist in backend data.
- [ ] Load detail records and associated rooms/tables/media using the existing API routes and actual IDs.
- [ ] Use actual room `price_per_night`; omit prototype ratings, amenity lists, fixed restaurant prices, and unsupported date-specific availability claims.
- [ ] Render loading, empty, not-found, and API error states; verify backend failure does not render prototype data.
- [ ] Verify links navigate by real resource IDs and do not rely on demo slugs.

### Task 3: Connect authentication and customer reservation flows

**Files:**
- Create/adapt: `frontend/src/components/CustomerLogin.tsx`
- Create/adapt: `frontend/src/components/CustomerRegister.tsx`
- Create/adapt: `frontend/src/components/CustomerReservations.tsx`
- Create/adapt: `frontend/src/components/CustomerCombinedBookings.tsx`
- Create/adapt: `frontend/src/components/CustomerProfile.tsx`
- Modify: `frontend/src/App.tsx`
- Reuse: `frontend/src/auth.tsx`, `frontend/src/api.ts`, `frontend/src/passwordPolicy.ts`, `frontend/src/types.ts`

**Interfaces:**
- Consumes: existing `login`, `register`, `logout`, and `updateProfile` auth methods plus reservation/combined-booking endpoints.
- Produces: polished screens for sign-in, registration, reservation creation/history, combined bookings, and profile backed by API state.

- [ ] Replace prototype sessionStorage authentication with the existing `AuthProvider`.
- [ ] Connect customer booking submission and reservation/history lists to existing APIs; preserve real server-side dates, statuses, and ownership behavior.
- [ ] Submit hotel reservations with `room_id`, dates, and `reservation_type: "HOTEL"`; restaurant reservations with `table_id`, date, times, and `reservation_type: "RESTAURANT"`.
- [ ] Submit combined bookings through `/combined-bookings/hotel-restaurant` with the backend's nested hotel and restaurant payload.
- [ ] Connect combined booking and profile forms to their current API endpoints; keep password recovery token handling intact.
- [ ] Test the review-focus cases for real auth, API failure, empty lists, customer booking permissions, and role-based status controls.

### Task 4: Preserve management workflows and complete frontend verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: existing management screens only where needed for navigation or shared visual consistency
- Create: `docs/superpowers/plans/2026-10-21-polished-frontend-manual-test-checklist.md`

**Interfaces:**
- Consumes: the integrated customer components and existing manager routes.
- Produces: one coherent frontend with customer and manager experiences; a manual test sequence for the user's live backend/database testing.

- [ ] Preserve Admin/Staff dashboard, inventory, reservations, reports, notifications, and user-management entry points.
- [ ] Verify Customer, Staff, and Admin reservation creation access and Admin/Staff-only status mutation controls.
- [ ] Run `npm run build` from `frontend/`; expected result is a successful TypeScript and Vite production build.
- [ ] Prepare a concise manual sequence for the user to verify login, database-backed listing reads, one CRUD flow, and role-based business rules on the live deployment.
- [ ] Do not run live dashboard/database operations; hand the user the integrated build and one-step-at-a-time live test checklist.
