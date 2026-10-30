import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-credential";

const {
    claimRefreshLease,
    commitRefreshedCredentials,
    createSessionRecord,
    failClosedRefreshLease,
    findSessionByCookieSecret,
    releaseRefreshLease,
    revokeSession,
    SessionStoreError
} = await import("../dist/services/session-store.js");

const rawCookieSecret = Buffer.alloc(32, 3);
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";
const cryptoMaterial = {
    ciphertext: Buffer.from("encrypted-token-pair"),
    nonce: Buffer.alloc(12, 1),
    authTag: Buffer.alloc(16, 2),
    keyVersion: 1
};

const asBytea = (value) => `\\x${Buffer.from(value).toString("hex")}`;

function fakeClient(result = { data: null, error: null }) {
    const calls = { table: null, insert: null, update: null, filters: [], selects: [] };
    const query = {
        insert(value) { calls.insert = value; return this; },
        update(value) { calls.update = value; return this; },
        select(value) { calls.selects.push(value); return this; },
        eq(column, value) { calls.filters.push(["eq", column, value]); return this; },
        is(column, value) { calls.filters.push(["is", column, value]); return this; },
        gt(column, value) { calls.filters.push(["gt", column, value]); return this; },
        maybeSingle: async () => result,
        single: async () => result
    };
    return {
        calls,
        client: { from(table) { calls.table = table; return query; } }
    };
}

function dbRow(overrides = {}) {
    return {
        session_id: sessionId,
        cookie_hash: asBytea(createHash("sha256").update(rawCookieSecret).digest()),
        user_id: userId,
        credentials_ciphertext: asBytea(cryptoMaterial.ciphertext),
        credentials_nonce: asBytea(cryptoMaterial.nonce),
        credentials_auth_tag: asBytea(cryptoMaterial.authTag),
        credentials_key_version: 1,
        access_token_expires_at: "2026-10-29T01:00:00.000Z",
        last_refreshed_at: "2026-10-29T00:00:00.000Z",
        created_at: "2026-10-29T00:00:00.000Z",
        last_activity_at: "2026-10-29T00:00:00.000Z",
        idle_expires_at: "2026-10-29T00:30:00.000Z",
        revoked_at: null,
        csrf_token_hash: asBytea(Buffer.alloc(32, 4)),
        purpose: "app",
        scope: "application",
        credentials_version: 0,
        refresh_state: "idle",
        refresh_lock_id: null,
        refresh_lease_until: null,
        refresh_started_at: null,
        ...overrides
    };
}

test("creates a session using only a SHA-256 cookie hash and encrypted material", async () => {
    const row = dbRow();
    const { client, calls } = fakeClient({ data: row, error: null });
    const created = await createSessionRecord({
        sessionId,
        userId,
        rawCookieSecret,
        rawCsrfToken: Buffer.alloc(32, 4),
        credentials: cryptoMaterial,
        accessTokenExpiresAt: new Date("2026-10-29T01:00:00.000Z"),
        lastRefreshedAt: new Date("2026-10-29T00:00:00.000Z"),
        createdAt: new Date("2026-10-29T00:00:00.000Z"),
        lastActivityAt: new Date("2026-10-29T00:00:00.000Z"),
        idleExpiresAt: new Date("2026-10-29T00:30:00.000Z"),
        purpose: "app",
        scope: "application"
    }, client);

    assert.equal(calls.table, "hrm_sessions");
    assert.equal(calls.insert.cookie_hash, asBytea(createHash("sha256").update(rawCookieSecret).digest()));
    assert.equal("rawCookieSecret" in calls.insert, false);
    assert.equal(calls.insert.credentials_ciphertext, asBytea(cryptoMaterial.ciphertext));
    assert.equal(calls.insert.csrf_token_hash, asBytea(createHash("sha256").update(Buffer.alloc(32, 4)).digest()));
    assert.equal(created.sessionId, sessionId);
});

test("looks up by the SHA-256 cookie hash and reports database errors", async () => {
    const { client, calls } = fakeClient({ data: dbRow(), error: null });
    const record = await findSessionByCookieSecret(rawCookieSecret, client);
    assert.equal(record.sessionId, sessionId);
    assert.deepEqual(calls.filters, [["eq", "cookie_hash", asBytea(createHash("sha256").update(rawCookieSecret).digest())]]);

    const failing = fakeClient({ data: null, error: { message: "database unavailable" } });
    await assert.rejects(findSessionByCookieSecret(rawCookieSecret, failing.client), SessionStoreError);
});

test("claims refresh with atomic expected-version and idle-state predicates", async () => {
    const { client, calls } = fakeClient({ data: dbRow({
        refresh_state: "in_flight",
        refresh_lock_id: "123e4567-e89b-42d3-a456-426614174010",
        refresh_lease_until: "2026-10-29T00:00:30.000Z",
        refresh_started_at: "2026-10-29T00:00:00.000Z"
    }), error: null });
    const claimed = await claimRefreshLease({
        sessionId,
        expectedCredentialsVersion: 9,
        leaseId: "123e4567-e89b-42d3-a456-426614174010",
        leaseUntil: new Date("2026-10-29T00:00:30.000Z"),
        startedAt: new Date("2026-10-29T00:00:00.000Z"),
        now: new Date("2026-10-29T00:00:00.000Z")
    }, client);

    assert.ok(claimed);
    assert.equal(calls.update.refresh_state, "in_flight");
    assert.ok(calls.filters.some(([, column, value]) => column === "credentials_version" && value === 9));
    assert.ok(calls.filters.some(([, column, value]) => column === "refresh_state" && value === "idle"));
});

test("commits refreshed credentials only under matching lease, version, state, and expiry", async () => {
    const lockId = "123e4567-e89b-42d3-a456-426614174010";
    const { client, calls } = fakeClient({ data: { session_id: sessionId }, error: null });
    const committed = await commitRefreshedCredentials({
        sessionId,
        expectedCredentialsVersion: 4,
        leaseId: lockId,
        credentials: cryptoMaterial,
        accessTokenExpiresAt: new Date("2026-10-29T01:00:00.000Z"),
        refreshedAt: new Date("2026-10-29T00:01:00.000Z"),
        now: new Date("2026-10-29T00:01:00.000Z")
    }, client);

    assert.equal(committed, true);
    assert.equal(calls.update.credentials_version, 5);
    assert.ok(calls.filters.some(([, column, value]) => column === "refresh_lock_id" && value === lockId));
    assert.ok(calls.filters.some(([, column, value]) => column === "credentials_version" && value === 4));
    assert.ok(calls.filters.some(([, column, value]) => column === "refresh_state" && value === "in_flight"));
    assert.ok(calls.filters.some(([method, column]) => method === "gt" && column === "refresh_lease_until"));
});

test("revokes by clearing all encrypted credentials and the CSRF hash", async () => {
    const { client, calls } = fakeClient({ data: { session_id: sessionId }, error: null });
    await revokeSession({ sessionId, revokedAt: new Date("2026-10-29T00:05:00.000Z") }, client);

    assert.equal(calls.update.revoked_at, "2026-10-29T00:05:00.000Z");
    assert.equal(calls.update.credentials_ciphertext, null);
    assert.equal(calls.update.credentials_nonce, null);
    assert.equal(calls.update.credentials_auth_tag, null);
    assert.equal(calls.update.credentials_key_version, null);
    assert.equal(calls.update.csrf_token_hash, null);
});

test("releases only the still-valid owner's lease before refresh dispatch", async () => {
    const lockId = "123e4567-e89b-42d3-a456-426614174010";
    const { client, calls } = fakeClient({ data: { session_id: sessionId }, error: null });
    const released = await releaseRefreshLease({
        sessionId,
        expectedCredentialsVersion: 2,
        leaseId: lockId,
        now: new Date("2026-10-29T00:00:00.000Z")
    }, client);

    assert.equal(released, true);
    assert.equal(calls.update.refresh_state, "idle");
    assert.ok(calls.filters.some(([, column, value]) => column === "refresh_lock_id" && value === lockId));
    assert.ok(calls.filters.some(([method, column]) => method === "gt" && column === "refresh_lease_until"));
});

test("ambiguous refresh revokes and scrubs the row while marking it uncertain", async () => {
    const lockId = "123e4567-e89b-42d3-a456-426614174010";
    const { client, calls } = fakeClient({ data: { session_id: sessionId }, error: null });
    const revoked = await failClosedRefreshLease({
        sessionId,
        expectedCredentialsVersion: 3,
        leaseId: lockId,
        revokedAt: new Date("2026-10-29T00:01:00.000Z")
    }, client);

    assert.equal(revoked, true);
    assert.equal(calls.update.refresh_state, "uncertain");
    assert.equal(calls.update.revoked_at, "2026-10-29T00:01:00.000Z");
    assert.equal(calls.update.credentials_ciphertext, null);
    assert.equal(calls.update.credentials_nonce, null);
    assert.equal(calls.update.credentials_auth_tag, null);
    assert.equal(calls.update.credentials_key_version, null);
    assert.equal(calls.update.csrf_token_hash, null);
    assert.ok(calls.filters.some(([, column, value]) => column === "refresh_lock_id" && value === lockId));
});
