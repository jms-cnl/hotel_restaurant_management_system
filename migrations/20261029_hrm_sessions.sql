-- HRMS session store migration
-- REVIEWED SQL FOR MANUAL SUPABASE SQL EDITOR EXECUTION ONLY.
-- Do not execute this file automatically through application startup or CI.
--
-- Manual procedure:
--   1. Run the preflight SELECT by itself and inspect the returned role.
--   2. Continue only when it reports current_user = 'postgres' and CREATE = true.
--   3. Select and run the migration transaction below.
--   4. Run the post-migration verification queries and inspect their results.
-- If the execution role is not postgres, stop and confirm the intended role first.

-- Preflight: execution role and required schema privilege.
SELECT
    current_user AS execution_role,
    has_schema_privilege(current_user, 'public', 'USAGE') AS has_public_usage,
    has_schema_privilege(current_user, 'public', 'CREATE') AS has_public_create;

-- Migration transaction. Run only after the preflight has been reviewed.
DO $$
BEGIN
    IF current_user <> 'postgres' THEN
        RAISE EXCEPTION 'Expected migration execution role postgres; current role is %', current_user;
    END IF;

    IF NOT has_schema_privilege(current_user, 'public', 'USAGE')
       OR NOT has_schema_privilege(current_user, 'public', 'CREATE') THEN
        RAISE EXCEPTION 'Migration role must have USAGE and CREATE on schema public';
    END IF;
END
$$;

BEGIN;

CREATE TABLE public.hrm_sessions (
    session_id uuid PRIMARY KEY,
    cookie_hash bytea NOT NULL UNIQUE,
    user_id uuid NOT NULL
        REFERENCES public."user"(user_id) ON DELETE CASCADE,

    -- AES-256-GCM encrypted access/refresh token pair.
    credentials_ciphertext bytea,
    credentials_nonce bytea,
    credentials_auth_tag bytea,
    credentials_key_version smallint,

    access_token_expires_at timestamptz,
    last_refreshed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    idle_expires_at timestamptz NOT NULL,
    revoked_at timestamptz,

    csrf_token_hash bytea,

    purpose text NOT NULL,
    scope text NOT NULL,

    credentials_version bigint NOT NULL DEFAULT 0,
    refresh_state text NOT NULL DEFAULT 'idle',
    refresh_lock_id uuid,
    refresh_lease_until timestamptz,
    refresh_started_at timestamptz,

    CONSTRAINT hrm_sessions_cookie_hash_len
        CHECK (octet_length(cookie_hash) = 32),
    CONSTRAINT hrm_sessions_csrf_hash_len
        CHECK (csrf_token_hash IS NULL OR octet_length(csrf_token_hash) = 32),
    CONSTRAINT hrm_sessions_crypto_material
        CHECK (
            (credentials_ciphertext IS NULL
             AND credentials_nonce IS NULL
             AND credentials_auth_tag IS NULL
             AND credentials_key_version IS NULL)
            OR
            (credentials_ciphertext IS NOT NULL
             AND octet_length(credentials_ciphertext) > 0
             AND octet_length(credentials_nonce) = 12
             AND octet_length(credentials_auth_tag) = 16
             AND credentials_key_version > 0)
        ),
    CONSTRAINT hrm_sessions_active_credentials
        CHECK (
            (revoked_at IS NULL
             AND credentials_ciphertext IS NOT NULL
             AND csrf_token_hash IS NOT NULL
             AND access_token_expires_at IS NOT NULL)
            OR
            (revoked_at IS NOT NULL
             AND credentials_ciphertext IS NULL
             AND credentials_nonce IS NULL
             AND credentials_auth_tag IS NULL
             AND credentials_key_version IS NULL
             AND csrf_token_hash IS NULL)
        ),
    CONSTRAINT hrm_sessions_idle_expiry
        CHECK (idle_expires_at > last_activity_at),
    CONSTRAINT hrm_sessions_revocation_time
        CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT hrm_sessions_purpose_scope
        CHECK (
            (purpose = 'app' AND scope = 'application')
            OR
            (purpose = 'recovery' AND scope = 'password_reset')
        ),
    CONSTRAINT hrm_sessions_refresh_state
        CHECK (
            (refresh_state = 'idle'
             AND refresh_lock_id IS NULL
             AND refresh_lease_until IS NULL
             AND refresh_started_at IS NULL)
            OR
            (refresh_state = 'in_flight'
             AND refresh_lock_id IS NOT NULL
             AND refresh_lease_until IS NOT NULL
             AND refresh_started_at IS NOT NULL)
            OR
            (refresh_state = 'uncertain'
             AND refresh_lock_id IS NULL
             AND refresh_lease_until IS NULL
             AND refresh_started_at IS NOT NULL
             AND revoked_at IS NOT NULL)
        ),
    CONSTRAINT hrm_sessions_version_nonnegative
        CHECK (credentials_version >= 0)
);

CREATE INDEX hrm_sessions_user_id_idx
    ON public.hrm_sessions (user_id);

CREATE INDEX hrm_sessions_idle_expiry_idx
    ON public.hrm_sessions (idle_expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX hrm_sessions_revoked_at_idx
    ON public.hrm_sessions (revoked_at)
    WHERE revoked_at IS NOT NULL;

ALTER TABLE public.hrm_sessions ENABLE ROW LEVEL SECURITY;

-- No browser-facing policies. Existing business-table policies and grants are untouched.
REVOKE ALL ON TABLE public.hrm_sessions
    FROM PUBLIC, anon, authenticated, service_role;

-- Isolated backend session-store operations, including future retention cleanup.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hrm_sessions
    TO service_role;

COMMIT;

-- Post-migration verification: table, RLS state, and policy count.
SELECT
    c.oid::regclass AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    (SELECT count(*)
       FROM pg_policy p
      WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'hrm_sessions';

-- Post-migration verification: expected effective table privileges by role.
SELECT
    role_name,
    has_table_privilege(role_name, 'public.hrm_sessions', 'SELECT') AS can_select,
    has_table_privilege(role_name, 'public.hrm_sessions', 'INSERT') AS can_insert,
    has_table_privilege(role_name, 'public.hrm_sessions', 'UPDATE') AS can_update,
    has_table_privilege(role_name, 'public.hrm_sessions', 'DELETE') AS can_delete
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
ORDER BY role_name;

-- Post-migration verification: inspect table constraints and indexes.
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.hrm_sessions'::regclass
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'hrm_sessions'
ORDER BY indexname;
