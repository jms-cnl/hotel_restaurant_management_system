# N1 Support Inbox Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Each sub-PR has its own test-first gate and must stay below 400 changed lines.

**Goal:** Let Customers submit support messages and let Admins review, resolve, and reopen them with a real backend Observer flow and scoped persistence.

**Architecture:** Add support-specific tables and policies in one new migration. Use the existing cookie-authenticated backend and request-scoped Supabase client. A backend `SupportMessageSubject` notifies a history observer for submissions and status changes and an Admin inbox notification observer for new submissions. Customer and Admin screens are added behind role-specific routes; current pages, APIs, sessions, CSRF behavior, booking rules, and existing RLS policies stay unchanged.

**Tech Stack:** Express, TypeScript, Supabase/PostgreSQL with RLS, React, TypeScript, Node test runner, `npm.cmd`.

**Spec:** User-approved N1 support inbox scope and decisions in the 2026-11-27 conversation.

## Global Constraints

- Keep every sub-PR under 400 changed lines and write its tests before implementation.
- Use only `open` and `resolved` statuses; Admins may reopen resolved messages.
- Subject maximum: 120 characters. Message maximum: 5,000 characters. No attachments.
- Do not add Customer-facing notifications in N1. Record resolve/reopen in history and the Admin inbox only.
- Do not change cookie-session design, CSRF handling, booking rules, route protection, or existing RLS policies.
- Do not expand `service_role` usage. New writes use the authenticated request context or the narrowly scoped migration function described below.
- No OCP classes under D15. The only interfaces/classes are those required for the G2 Observer pattern.
- Keep H39 and H40 out of scope.

## Review Focus

- Logic & Control Flow (35%): empty submissions, persistence errors, valid state changes, reopen behavior, observer attach/detach/notify, and observer failure handling.
- Input Validation & Security (25%): Customer ownership comes from authenticated identity; Customers cannot read or alter another Customer's messages; only Admins can read all messages or change status; SQL remains parameterized; no secrets or service-role keys are introduced.
- Resource Management & Error Handling (20%): failed requests return safe errors; observer writes are idempotent; no duplicate support message is created by client retry; loading, empty, and failure states are handled.
- Code Maintainability (20%): route/controller/service/UI responsibilities stay focused; Observer depends on interfaces; do not add unrelated classes or refactor existing pages.
- Apply the G6 checklist to every PR: at least one yes/no review item per category above, under-400-line diff, constructive review tone, automated basics handled by CI, and the 24-hour review window.

## Observer Pattern Mapping

| Pattern role | Project class/interface | File |
|---|---|---|
| Subject interface | `SupportMessageSubjectContract` with `attach`, `detach`, and `notify` | `src/services/support-message-observer.ts` |
| Observer interface | `SupportMessageObserver` with `update(event)` | `src/services/support-message-observer.ts` |
| Concrete Subject | `SupportMessageSubject`, holding attached observers | `src/services/support-message-observer.ts` |
| Concrete Observer | `SupportMessageHistoryObserver` | `src/services/support-message-observer.ts` |
| Concrete Observer | `AdminInboxNotificationObserver` | `src/services/support-message-observer.ts` |
| Client | `submitSupportMessage` and `updateSupportMessageStatus` attach observers and call `notify` | `src/services/support-message.service.ts` |

The event is a typed union for `submitted` and `status_changed`, carrying the message ID, actor ID, and old/new status where applicable. The subject depends only on `SupportMessageObserver`; the Admin notification observer acts only on submissions. The history observer records submissions, resolves, and reopens. Include this mapping and a UML class diagram with method signatures and dependency directions in the course documentation.

## Sub-PR 1a: Support Schema

**Branch:** `codex/n1-support-schema`  
**Estimate:** ~300 changed lines  
**Files:** Create `migrations/20261127_n1_support_inbox.sql`; create `tests/support-message-migration.test.mjs`; include this plan file.

**Contract:** Add only the three support tables, their indexes and new-table RLS policies, plus the narrowly scoped Admin notification trigger. Do not change existing migrations or policies, or introduce `service_role` use.

**Test-first steps:** Write migration contract tests first and confirm they fail because the migration is absent. Run the targeted migration test, `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.

## Sub-PR 1b: Customer Submit API

**Branch:** `codex/n1-support-submit-api`  
**Estimate:** ~230 changed lines  
**Files:** Create `src/routes/support-message.routes.ts`, `src/controllers/support-message.controller.ts`, and `src/services/support-message.service.ts`; modify `src/server.ts` to mount `/api/support-messages`; create `tests/support-message-submit.test.mjs`.

**Contract:** `POST /api/support-messages` is Customer-only. Derive `customer_id` from `req.auth.user.id`; reject client-supplied ownership. Validate required subject/message fields and their limits, set status to `open`, and return the created message's safe fields. No Observer code, status-change, or Customer notification behavior.

**Test-first steps:** Write behavioral route/middleware and database-error tests first and confirm they fail before implementing the route/service. Run the targeted submit test, `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.

## Sub-PR 2: Observer Flow and Admin API

**Branch:** `codex/n1-support-observer-admin-api`  
**Estimate:** ~370 changed lines  
**Files:**
- Create `src/services/support-message-observer.ts` with the two interfaces, `SupportMessageSubject`, and both concrete observers.
- Modify `src/services/support-message.service.ts`, `src/routes/support-message.routes.ts`, and `src/controllers/support-message.controller.ts` to wire notifications for submission and status changes, and add Admin list/detail/status operations.
- Test `tests/support-message-observer.test.mjs`.
- Test `tests/support-message-admin.test.mjs`.

**Contract:** Admin-only `GET /api/support-messages`, `GET /api/support-messages/:id`, and `PATCH /api/support-messages/:id/status`. Validate `open`/`resolved` only. Each service invocation creates a subject, attaches the concrete observers, persists the state change, and notifies them. Notification creation uses the migration's restricted function; history records each event. Do not notify Customers on resolve/reopen.

**Test-first steps:** Prove Subject attach/detach/notify, both observers' real database effects, submit/status wiring, Admin-only access, status validation, and repeat-safe notifications. Confirm targeted failures before implementation; finish with backend tests and typecheck.

## Sub-PR 3: Customer Submit UI

**Branch:** `codex/n1-support-customer-ui`  
**Estimate:** ~190 changed lines  
**Files:** Create `frontend/src/components/CustomerSupportForm.tsx` and `frontend/tests/customerSupportForm.test.ts`; modify `frontend/src/App.tsx` and `frontend/src/customer-theme.css`.

Add a Customer-only `/support` route with accessible subject/message fields, limits matching the API, submit/loading/success/error states, and a request to `POST /support-messages`. Do not add booking changes or expose a Customer ID field.

**Test-first steps:** Cover labels, required/length constraints, endpoint and payload, visible success/error feedback, and role-specific route access. Confirm targeted failure before implementation; finish with frontend tests, typecheck, and build.

## Sub-PR 4: Admin Inbox UI

**Branch:** `codex/n1-support-admin-ui`  
**Estimate:** ~280 changed lines  
**Files:** Create `frontend/src/components/AdminSupportInbox.tsx` and `frontend/tests/adminSupportInbox.test.ts`; modify `frontend/src/App.tsx` and `frontend/src/admin-theme.css`.

Add an Admin-only `/support-inbox` route with Open/Resolved filters, message list, message detail, and resolve/reopen actions. Show the Customer's safe identity fields and message timestamps. Keep Staff and Customer routes unchanged.

**Test-first steps:** Cover Admin-only access, list/detail, empty/loading/error states, status filters, resolve/reopen payloads, and existing page/route preservation. Confirm targeted failure before implementation; finish with frontend tests, typecheck, and build.

## Migration SQL Outline

Create the following in the single new migration; do not edit existing migrations or policies:

- `public.support_message`: identity primary key; `customer_id uuid` foreign key to `public."user"(user_id)`; `subject varchar(120)` and `message text` with length checks; `status text` default `open` constrained to `open`/`resolved`; `created_at` and `updated_at` timestamps. Index `(customer_id, created_at desc)` and `(status, created_at desc)`.
- `public.support_message_history`: identity key, `support_message_id` foreign key, `actor_user_id`, event type (`submitted`/`status_changed`), previous/new status, and timestamp. Index `(support_message_id, created_at)`.
- `public.support_message_admin_notification`: support message foreign key, Admin recipient ID, and creation timestamp; unique `(support_message_id, admin_user_id)` to make retries safe; index `(admin_user_id, created_at desc)`.

Enable RLS on all three tables. Messages: Customers insert/select only their own rows; Admins select all and update status; no delete policy. History: Customer owner/Admin may select; permit inserts only for the owner-submission or Admin-status-change event; deny update/delete. Admin notification rows: Admins select their own; deny direct client insert/update/delete.

Add a narrowly scoped `SECURITY DEFINER` function used by `AdminInboxNotificationObserver` to insert Admin notification rows for a submitted message. Fix `search_path` to `pg_catalog, public`; check `auth.uid()`, Customer role, and ownership of the submitted open message inside the function; `REVOKE EXECUTE FROM PUBLIC, anon`; grant execute only to `authenticated` if required by the request-scoped call. Add no service-role grants or use. Add a migration test for role/owner checks, fixed search path, grants, RLS, constraints, and indexes.

## Verification Commands

- Backend targeted: run `tests/support-message-migration.test.mjs` in Sub-PR 1a and `tests/support-message-submit.test.mjs` in Sub-PR 1b; each later backend PR adds its named test files to a targeted command.
- Backend full checks: `npm.cmd test` and `npm.cmd run typecheck`.
- Frontend full checks: `npm.cmd --prefix frontend test`, `npm.cmd --prefix frontend run typecheck`, and `npm.cmd --prefix frontend run build`.
