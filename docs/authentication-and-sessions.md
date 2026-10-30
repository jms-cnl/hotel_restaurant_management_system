# HRMS Authentication and Session Operations

## Architecture

Supabase Auth is the identity provider. Express creates an HRMS session after Supabase login or registration and sends a random opaque `hrm_session` cookie. The database stores only the SHA-256 cookie-secret hash. Supabase access and refresh tokens are encrypted in `public.hrm_sessions` with AES-256-GCM; the browser never receives these credentials.

The server-only session-store client uses `SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY` and is isolated to session-store operations. Business-data requests use `SUPABASE_KEY` plus the authenticated user's access token so Supabase RLS continues to see that user. Do not use the session-store client for business data or expose its credential to the frontend.

The browser stores neither Supabase access nor refresh tokens in local or session storage. The backend still accepts legacy bearer-authenticated requests when no HRMS cookie is present, for compatibility. The current frontend does not use that path; remove it only after confirming no external clients depend on it.

## Lifecycle

- **Login:** Express authenticates with Supabase Auth, reads the user's profile with a user-scoped client, creates an encrypted session record, and sets the opaque cookie. API responses contain safe profile/session metadata and a session-bound CSRF token, never Supabase tokens.
- **Registration:** Supabase signup/profile behavior is preserved. If Supabase returns a session immediately, Express creates the HRMS cookie session; if email confirmation is required and no session is returned, the user signs in later.
- **Requests:** The API hashes the cookie secret, resolves and validates the session, decrypts credentials server-side, verifies the Supabase user, and resolves the current profile role. The current profile is authoritative for authorization and idle timeout.
- **Logout:** Revokes and scrubs only the current browser session, then clears its cookie. It does not revoke other browser sessions for that user.
- **Password recovery:** The frontend exchanges link tokens with the backend without persisting them. The API creates a restricted recovery-purpose session. It can access recovery status/CSRF and password reset only; it cannot access ordinary application routes. A successful reset revokes and scrubs the recovery session and requires normal sign-in.

## Expiration and activity

Customer sessions expire after 30 minutes without meaningful activity. Staff and Admin sessions expire after 15 minutes. The frontend warns two minutes before its estimated expiry; the backend enforces expiration. Explicit user input and successful state-changing authenticated requests update activity. Background polling and ordinary GET requests do not. No absolute session lifetime is currently enforced.

## Refresh-token handling

Near access-token expiry, one backend process claims a database refresh lease using the session ID, credentials version, and lock ID before calling Supabase. It verifies lease ownership before and after refresh and commits rotated credentials only while lease ID, version, state, and lease expiry still match. A competing process that cannot claim the lease fails the request. If refresh may have reached Supabase but its outcome is ambiguous, the session is revoked and credential material is cleared; the old rotating refresh token is never retried. An expired in-flight lease also fails closed. Users must sign in again after an ambiguous outcome.

## Cookies and CSRF

`hrm_session` is HttpOnly, host-only (no `Domain`), `Path=/`, and Secure in production. SameSite defaults to `lax` in development and `none` in production; `none` requires Secure. Credentialed CORS accepts only exact origins listed in `CORS_ORIGINS`. Browser state-changing requests require the CSRF token returned by the backend bootstrap endpoint in `X-CSRF-Token`. The CSRF token is bound to the session and held in frontend memory only. Recovery mutations use the recovery CSRF bootstrap endpoint.

For deployment, configure exact browser frontend origins in the API's `CORS_ORIGINS`. Set the frontend build variable `VITE_API_BASE_URL` to the API base ending in `/api`. Cross-site frontend/API deployments need compatible SameSite=None cookies and HTTPS; browsers may restrict third-party cookies, so same-site deployment is preferable. Configure `FRONTEND_RESET_REDIRECT_URL` to the deployed HTTPS reset page.

## Environment configuration

Backend values are documented in the root `.env.example`:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_KEY`: publishable/anon project key used with a user's access token for RLS-preserving requests and Supabase Auth.
- `SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY`: server-only service-role/secret credential for session-store access only.
- `HRMS_SESSION_ENCRYPTION_KEY`: canonical base64 encoding of exactly 32 random bytes. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`; store in the backend secret manager, never in a `VITE_` variable.
- `HRMS_SESSION_ENCRYPTION_KEY_VERSION`: positive integer identifying the configured key.
- `CORS_ORIGINS`: comma-separated exact origins, without paths or wildcard.
- `FRONTEND_RESET_REDIRECT_URL`: frontend password-reset URL.
- `HRMS_SESSION_COOKIE_SAME_SITE`: optional `strict`, `lax`, or `none`; defaults depend on environment.
- `NODE_ENV`, `PORT`, and `HOST`: runtime settings; `PORT` and `HOST` have defaults.

Frontend configuration is `VITE_API_BASE_URL` in `frontend/.env.example`; it is build-time and must contain no secrets.

## Key rotation, retention, and limitations

The current crypto configuration accepts one encryption key version at a time. Changing the key or version does not provide dual-key decryption or re-encryption; existing sessions encrypted under the old version will fail closed and require sign-in. Plan key rotation as coordinated session invalidation unless versioned multi-key support and rewrapping are designed and implemented first. Keep the service-role credential and encryption key separate, backend-only, and rotate them through the hosting secret manager.

Revoked sessions are retained for 30 days. The schema and application support revocation, but no scheduled cleanup/purge job is currently implemented. A future cleanup must delete only revoked rows older than the retention window and idle-expired rows that have been expired for at least 30 days; it must exclude active sessions. There is no absolute session lifetime.

## Migration and deployment operations

The `public.hrm_sessions` migration has been applied and verified separately. No migration runs automatically at application startup. For future database changes, execute reviewed migrations through the agreed Supabase SQL Editor process and verify the execution role at the time; `postgres` is the proposed role, not an assumed fact for every execution. Do not grant browser-facing `anon` or `authenticated` access to the session table.

Before deployment testing, set all backend secrets in the API host, set the exact frontend origin allowlist, configure the frontend API base and reset URL, build the frontend with the target API URL, and verify cookies over the intended HTTPS/site topology. This document does not claim production verification.
