# HRM System Completion Plan

> **For agentic workers:** Execute the tasks in order. Do not apply database changes or expose secrets. The user requested research and planning first, then continuation through safely completable work.

**Goal:** Complete the feasible integration and frontend work for the HRM application, verify it as far as the available local environment permits, and leave a truthful handoff report.

**Architecture:** Preserve the existing React/Vite frontend, Express API, and Supabase integration on `main`. Integrate only features supported by the current API and schema. Keep company-level isolation, account administration, and payment persistence out until the required backend schema and credentials are available.

**Tech Stack:** React 19, Vite 7, TypeScript, Express 5, Supabase JS v2.

**Spec:** User-provided HRM project brief; source requirements in `System Definition and Requirements.md`.

## Global Constraints

- Preserve existing local work; checkout was clean on `main` at `9b1a8eadb44b8337c572129b092cef635c04501e` before work.
- Never read secrets into command output, commit `.env`, or expose service-role credentials.
- Use the existing Express routes and Supabase schema; no direct Supabase calls from the frontend.
- Do not apply database migrations, modify production data, or deploy over an unverified target.
- The reviewed Roles documents explicitly permit Admin, Staff, and Customer to create reservations and combined bookings; retain other role restrictions.
- Do not invent company-level isolation where the schema has no company or staff-assignment relationship.
- Distinguish implementation from actual verification and label every blocked or untested feature.

## Review Focus

- Expired or malformed auth tokens: show a useful error and protect private routes.
- Customer direct navigation to manager pages: block in the frontend and retain backend enforcement.
- Reservation and combined-booking creation: permit Customer, Staff, and Admin at the frontend and backend boundary, as specified in the reviewed Roles documents.
- Cross-establishment staff access: explicitly disclose that current schema/API cannot scope records.
- Missing payment persistence and email delivery: do not simulate durable success or claim real financial activity.

---

## Research Findings (Phase 1)

- The local repository has one integrated `main` branch and a remote `frontend-pages` branch. The latter adds a separate, standalone `reservation-system/` Vite app and is not an ancestor or continuation of `main`; the existing `frontend/` already contains the API-integrated app. Do not merge the standalone branch wholesale.
- `main` has root-level Express/TypeScript source, a `frontend/` React/Vite app, and one checked-in media-support migration. It contains no company model, staff-establishment mapping, payment table, or PDF lab file. Netlify build/SPA configuration and backend host port/CORS configuration have since been prepared locally; no hosting provider is configured.
- Existing backend routes cover auth, self-profile, hotels, restaurants, rooms, tables, reservations, combined bookings, notifications, media, dashboard, and reports. User routes only expose `/api/users/me`; there is no staff-account/user administration API.
- Existing frontend has auth, role-aware navigation and route gates, resource CRUD/media, reservations, combined bookings, notifications, dashboard, reports, profile/password flows, and a placeholder Admin Users page. Its API calls use a configurable `VITE_API_BASE_URL`, defaulting to same-origin `/api` with the Vite development proxy.
- Reviewed documents include System Definition and Requirements, Frontend Guide, Frontend Setup Guide, user-provided `Roles.md` and `Roles.md.docx`, Development Tracker, `supabase-schema.csv`, and `supabase-foreign-keys.csv`. The source SRS makes OTP/SMS and ML future phases. The tracker says UI/UX, user-feedback enhancements, comprehensive tests, and deployment are pending.
- The reviewed Roles documents state Admin, Staff, and Customer may create reservations and combined bookings; Admin also has the Staff permissions plus Admin functions. Two user-feedback files are M4A recordings; contents were not transcribed. `FRONTEND_REFERENCE.md` is cited by the setup guide but is absent from the visible folders. No PDF appeared in the checked project tree or planning/setup folders.
- Schema shows user/role, hotel, restaurant, room, restaurant_table, reservation, combined_booking, notification, reservation_status_history, and media. Reservation/booking ownership is by user. There is no company foreign key, staff assignment, or payment schema. Foreign keys confirm resource ownership relationships but not company-level access.
- Existing auth middleware verifies Supabase tokens and reads the role. Routes permit Staff/Admin management; reservations are customer-owned for Customer and broadly accessible to non-Customers. No company scoping exists. Backend uses the Supabase client configured via environment, but account-level deployment credentials are not configured in shell and no Netlify/Railway/Render CLI was found.
- Baseline backend and frontend production builds both passed locally; this does not establish that the deployed application builds or works correctly.
- Deployment research: Netlify’s official Vite guide calls for `npm run build` and `dist`, and its SPA guidance requires a rewrite for history-based routes. A Netlify build file and `_redirects` rule are prepared. Render’s official Express guide confirms it supports Express services that bind to `0.0.0.0` and use `PORT`; it is the current backend hosting recommendation. No provider was provisioned or deployed.

## Plan

### Task 1: Keep the verified integration base

**Files:** none planned.

- [x] Check branch, remotes, worktree, tracked files, history, and remote branches.
- [x] Fetch `origin` without merging or overwriting local files.
- [x] Compare `main` with `origin/frontend-pages`; retain integrated `main` as the implementation base.

### Task 2: Harden app configuration and role boundaries

**Files:** `frontend/src/api.ts`, `frontend/vite.config.ts`, `src/server.ts`, `src/routes/reservation.routes.ts`, and related focused tests if present.

- [x] Add an environment-configurable frontend API base URL while preserving `/api` as the local default.
- [x] Configure production backend port binding and CORS using an explicit origin allowlist from environment configuration.
- [x] Permit Admin, Staff, and Customer reservation and combined-booking creation at both UI and API boundaries, as required by the Roles documents.
- [x] Record that Staff/Admin company isolation is not supported by the current schema or API.
- [x] Rebuild both applications and inspect the diff.

### Task 3: Complete supported Admin/Staff frontend surfaces

**Files:** follow existing `frontend/src/` organization and components in `frontend/src/App.tsx` only where established patterns require.

- [x] Preserve the existing role-aware navigation and route gates, and expose reservation/combined-booking create forms to Admin, Staff, and Customer.
- [x] Keep existing Staff operational pages connected to current endpoints and preserve Customer booking features.
- [x] Retain the Admin Users page’s accurate explanation that user CRUD is not available through the backend.
- [ ] Fully audit all empty, loading, validation, 401/403, and server-error states; this remains NOT VERIFIED.
- [x] Build frontend; browser smoke check confirmed the login page and protected `/dashboard` redirect. Authenticated data-backed routes were not exercised.

### Task 4: Payment and deployment readiness

- [x] Confirm payment persistence is unsupported by current schema/API; do not add a fake or non-persistent mock payment workflow without a payment-state model and business rules.
- [x] Inspect deployment configuration and tool/account availability. No deployment account/credentials/target were available; Netlify build and SPA routing configuration was prepared.
- [ ] Do not make production database changes or apply unreviewed migrations.

### Task 5: Verification and handoff

**Files:** `HANDOFF_REPORT.md`.

- [x] Local verification: backend build succeeded and `npm test` passed all 15 tests with zero failures; frontend production build succeeded and copies the Netlify rewrite. These results do not establish that the deployed application builds or works correctly.
- [x] Frontend smoke and CORS checks passed locally. Data-backed authentication and CRUD tests were blocked because the Supabase target could not be verified as non-production.
- [x] Final Git status and `.env` ignore rule checked; no values from `.env` were exposed or committed.
- [x] Record completed work, verified results, remaining work, deployment status, limitations, and exact local start commands in `HANDOFF_REPORT.md`.
