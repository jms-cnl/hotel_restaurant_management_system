# Polished Frontend Integration Design

## Goal

Integrate the colleague-built polished customer interface from the `frontend-pages` branch into the existing `frontend` app, which is the app deployed by Netlify. The integrated interface must use the existing HRM backend for real application data and operations. Testing will happen after implementation, with the user handling live-site and database checks.

## Current context

- `main` contains the deployed backend-connected React app under `frontend/`.
- `origin/frontend-pages` contains a separate visual prototype under `reservation-system/`; several of its pages use sample content and are not yet connected to the existing backend.
- The prototype is committed with flattened component paths that do not match its imports, and its `index.html` points to a missing `src/main.tsx`; it is not a working deploy target as-is.
- The backend is hosted separately on Render and exposes authenticated resource, reservation, booking, profile, and administrative routes.
- Resource routes require authentication, so customer discovery will remain behind the existing sign-in gate in this work.
- The Netlify frontend build must continue to use `frontend/` and `VITE_API_BASE_URL`.
- The current deployment remains unchanged until the user authorizes a commit, push, or deployment.

## Integration approach

Port the polished customer-facing layouts and visual assets into `frontend/src`, adapting the existing React components rather than deploying the prototype as a second app. Keep the current `frontend/src/api.ts`, `frontend/src/auth.tsx`, token handling, route guards, password recovery flow, and backend contracts as the source of truth for server communication. The prototype's demo login and registration must be replaced by the existing AuthProvider.

Replace prototype/sample listing data with API responses. Connect hotel and restaurant discovery/details, reservation creation and history, combined bookings, profile, and auth screens to the current endpoints. Use actual IDs for detail routes. Display only backend fields (for example, room nightly price) and do not invent ratings, amenity lists, per-person restaurant prices, or date availability that the backend does not provide. Preserve the existing Admin and Staff dashboard and management routes; apply the polished design language where it fits without removing their current functions.

## Data and access behavior

- Resource reads and writes go through the existing API client and authenticated bearer token.
- Customer, Staff, and Admin retain the currently established ability to create reservations and combined bookings.
- Only Staff and Admin can change reservation status; the customer reservation view is read-only after submission.
- The frontend must show loading, empty, success, and API error states rather than substituting mock records when a request fails.
- Keep form validation aligned with the backend's existing validation and password policy.
- Do not change database schema, Supabase RLS policies, or backend permissions as part of this frontend integration.

## Deployment and review

- Keep the existing Netlify project/build root and Render API deployment configuration.
- Do not commit, push, or deploy without the user's explicit authorization.
- After implementation, provide a concise change summary and wait for the user's testing step. Do not claim live database or CRUD behavior until the user verifies it.

## Acceptance criteria

1. The existing Netlify app builds from `frontend/` and retains the polished colleague-provided customer visual design.
2. Customer-facing listings and details display records returned by the backend, not hard-coded sample listings.
3. Authentication, reservation creation/history, combined bookings, and profile operations continue to call the existing backend routes.
4. Admin and Staff features and the established reservation permission rules remain available.
5. The app handles loading, empty, validation, and backend error states without implying that failed requests succeeded.
6. No database, Supabase policy, backend permission, or deployment configuration change is included in this work.
