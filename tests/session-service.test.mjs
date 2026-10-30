import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-credential";

const { createSessionService, verifySessionCsrfToken } = await import("../dist/services/session.service.js");
const { encryptSessionCredentials } = await import("../dist/services/session-crypto.js");
const encryptionConfig = { key: Buffer.alloc(32, 8), keyVersion: 1 };
const start = new Date("2026-10-29T00:00:00.000Z");
const userId = "123e4567-e89b-42d3-a456-426614174001";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const credentials = { accessToken: "access", refreshToken: "refresh" };

function makeStore() {
    const calls = {};
    const record = {
        sessionId,
        userId,
        cookieHash: Buffer.alloc(32, 1),
        credentials: null,
        accessTokenExpiresAt: "2026-10-29T01:00:00.000Z",
        lastRefreshedAt: start.toISOString(),
        createdAt: start.toISOString(),
        lastActivityAt: start.toISOString(),
        idleExpiresAt: "2026-10-29T00:30:00.000Z",
        revokedAt: null,
        csrfTokenHash: createHash("sha256").update(Buffer.alloc(32, 2)).digest(),
        purpose: "app",
        scope: "application",
        credentialsVersion: 0,
        refreshState: "idle",
        refreshLockId: null,
        refreshLeaseUntil: null,
        refreshStartedAt: null
    };
    const store = {
        async createSessionRecord(input) {
            calls.create = input;
            return {
                ...record,
                sessionId: input.sessionId,
                userId: input.userId,
                credentials: input.credentials,
                accessTokenExpiresAt: input.accessTokenExpiresAt.toISOString(),
                createdAt: input.createdAt.toISOString(),
                lastActivityAt: input.lastActivityAt.toISOString(),
                idleExpiresAt: input.idleExpiresAt.toISOString(),
                purpose: input.purpose,
                scope: input.scope
            };
        },
        async findSessionByCookieSecret(secret) { calls.lookupSecret = secret; return { ...record, credentials: record.credentials }; },
        async updateSessionActivity(input) { calls.activity = input; return true; },
        async updateSessionCsrfHash(input) { calls.csrf = input; return true; },
        async revokeSession(input) { calls.revoke = input; return true; },
        async claimRefreshLease(input) { calls.claim = input; return { ...record, refreshState: "in_flight", refreshLockId: input.leaseId }; },
        async verifyRefreshLease(input) { calls.verify = input; return true; },
        async commitRefreshedCredentials(input) { calls.commit = input; return false; },
        async releaseRefreshLease(input) { calls.release = input; return true; },
        async failClosedRefreshLease(input) { calls.failClosed = input; return true; }
    };
    return { store, calls, record };
}

test("creates opaque app and recovery sessions with role-based idle expiry", async () => {
    const { store, calls } = makeStore();
    const service = createSessionService({
        store,
        getEncryptionConfig: () => encryptionConfig,
        now: () => start,
        makeId: () => sessionId,
        makeSecret: (size) => Buffer.alloc(size, 2)
    });

    const issued = await service.createApplicationSession({ userId, roleName: "Customer", credentials, accessTokenExpiresAt: new Date("2026-10-29T01:00:00.000Z") });
    assert.match(issued.cookieSecret, /^[A-Za-z0-9_-]{43}$/);
    assert.match(issued.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(issued.session.idleExpiresAt, "2026-10-29T00:30:00.000Z");
    assert.equal("roleName" in calls.create, false);
    assert.equal(calls.create.scope, "application");

    const staff = await service.createRecoverySession({ userId, roleName: "Staff", credentials, accessTokenExpiresAt: new Date("2026-10-29T01:00:00.000Z") });
    assert.equal(staff.session.idleExpiresAt, "2026-10-29T00:15:00.000Z");
    assert.equal(calls.create.scope, "password_reset");
});

test("rejects unknown roles and malformed cookie secrets", async () => {
    const { store } = makeStore();
    const service = createSessionService({ store, getEncryptionConfig: () => encryptionConfig, now: () => start });
    await assert.rejects(service.createApplicationSession({ userId, roleName: "Owner", credentials, accessTokenExpiresAt: new Date("2026-10-29T01:00:00.000Z") }), /unknown role/);
    assert.equal(await service.resolveSession("not-a-session-cookie"), null);
});

test("an expired in-flight lease is revoked and cannot remain usable", async () => {
    const { store, calls, record } = makeStore();
    record.refreshState = "in_flight";
    record.refreshLockId = "123e4567-e89b-42d3-a456-426614174010";
    record.refreshLeaseUntil = "2026-10-29T00:00:01.000Z";
    record.refreshStartedAt = start.toISOString();
    const service = createSessionService({ store, getEncryptionConfig: () => encryptionConfig });

    const resolved = await service.resolveSession(Buffer.alloc(32, 2).toString("base64url"), new Date("2026-10-29T00:00:02.000Z"));

    assert.equal(resolved, null);
    assert.equal(calls.failClosed.leaseId, record.refreshLockId);
});

test("ordinary session resolution rejects recovery purpose before decrypting credentials", async () => {
    const { store, record } = makeStore();
    record.purpose = "recovery";
    record.scope = "password_reset";
    record.credentials = encryptSessionCredentials(sessionId, userId, credentials, encryptionConfig);
    const service = createSessionService({ store, getEncryptionConfig: () => encryptionConfig, now: () => start });
    const cookie = Buffer.alloc(32, 2).toString("base64url");

    assert.equal(await service.resolveSession(cookie, start), null);
    const recoverySession = await service.resolveSession(cookie, start, { allowRecovery: true });
    assert.deepEqual(recoverySession.credentials, credentials);
    assert.equal(recoverySession.session.scope, "password_reset");
});

test("verifies session-bound CSRF tokens using constant-time digest comparison", () => {
    const raw = Buffer.alloc(32, 5);
    const token = raw.toString("base64url");
    const hash = createHash("sha256").update(raw).digest();
    assert.equal(verifySessionCsrfToken(hash, token), true);
    assert.equal(verifySessionCsrfToken(hash, Buffer.alloc(32, 6).toString("base64url")), false);
    assert.equal(verifySessionCsrfToken(hash, "bad"), false);
});

test("refresh success commits with a versioned lease; ambiguity revokes fail-closed", async () => {
    const { store, calls } = makeStore();
    const service = createSessionService({
        store,
        getEncryptionConfig: () => encryptionConfig,
        now: () => start,
        makeId: () => "123e4567-e89b-42d3-a456-426614174010"
    });
    const lease = await service.claimRefresh(sessionId, userId, 0, start);
    assert.ok(lease);
    assert.equal(lease.expectedCredentialsVersion, 0);
    assert.equal(lease.leaseUntil.toISOString(), "2026-10-29T00:00:30.000Z");
    assert.equal(await service.verifyRefreshLease(lease, start), true);
    assert.equal(await service.commitRefresh(lease, credentials, new Date("2026-10-29T01:00:00.000Z"), start), false);
    assert.equal(calls.commit.credentials.keyVersion, 1);
    assert.equal(await service.failClosedRefresh(lease, start), true);
    assert.equal(calls.failClosed.leaseId, lease.leaseId);
});

test("resolves an expiring session with rotated credentials and a versioned commit", async () => {
    const { store, calls, record } = makeStore();
    const expiringAt = new Date("2026-10-29T00:10:00.000Z");
    const cookie = Buffer.alloc(32, 2).toString("base64url");
    record.credentials = encryptSessionCredentials(sessionId, userId, credentials, encryptionConfig);
    record.accessTokenExpiresAt = "2026-10-29T00:09:00.000Z";
    let refreshCalls = 0;
    const rotated = { accessToken: "rotated-access", refreshToken: "rotated-refresh", expiresAt: new Date("2026-10-29T01:10:00.000Z") };
    store.commitRefreshedCredentials = async (input) => { calls.commit = input; return true; };
    const service = createSessionService({
        store,
        getEncryptionConfig: () => encryptionConfig,
        now: () => expiringAt,
        makeId: () => "123e4567-e89b-42d3-a456-426614174010",
        refreshCredentials: async (refreshToken) => {
            refreshCalls += 1;
            assert.equal(refreshToken, credentials.refreshToken);
            return rotated;
        }
    });

    const resolved = await service.resolveSession(cookie, expiringAt);

    assert.deepEqual(resolved.credentials, { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken });
    assert.equal(resolved.session.credentialsVersion, 1);
    assert.equal(resolved.session.accessTokenExpiresAt, rotated.expiresAt.toISOString());
    assert.equal(refreshCalls, 1);
    assert.equal(calls.commit.expectedCredentialsVersion, 0);
});

test("concurrent session resolutions dispatch only one rotating refresh token", async () => {
    const { store, record } = makeStore();
    const expiringAt = new Date("2026-10-29T00:10:00.000Z");
    const cookie = Buffer.alloc(32, 2).toString("base64url");
    record.credentials = encryptSessionCredentials(sessionId, userId, credentials, encryptionConfig);
    record.accessTokenExpiresAt = "2026-10-29T00:09:00.000Z";
    let refreshCalls = 0;
    let leaseClaimed = false;
    let signalRefreshStarted;
    const refreshStarted = new Promise((resolve) => { signalRefreshStarted = resolve; });
    let finishRefresh;
    const refreshResult = new Promise((resolve) => { finishRefresh = resolve; });
    store.claimRefreshLease = async (input) => {
        if (leaseClaimed) return null;
        leaseClaimed = true;
        record.refreshState = "in_flight";
        record.refreshLockId = input.leaseId;
        record.refreshLeaseUntil = input.leaseUntil.toISOString();
        return { ...record };
    };
    store.verifyRefreshLease = async () => true;
    store.commitRefreshedCredentials = async () => true;
    const rotated = { accessToken: "rotated-access", refreshToken: "rotated-refresh", expiresAt: new Date("2026-10-29T01:10:00.000Z") };
    const service = createSessionService({
        store,
        getEncryptionConfig: () => encryptionConfig,
        now: () => expiringAt,
        makeId: () => "123e4567-e89b-42d3-a456-426614174010",
        refreshCredentials: async () => {
            refreshCalls += 1;
            signalRefreshStarted();
            return refreshResult;
        }
    });

    const first = service.resolveSession(cookie, expiringAt);
    await refreshStarted;
    const second = await service.resolveSession(cookie, expiringAt);
    finishRefresh(rotated);
    const firstResolved = await first;

    assert.equal(second, null);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(firstResolved.credentials, { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken });
});

test("fails closed and never retries the old refresh token after an ambiguous error", async () => {
    const { store, calls, record } = makeStore();
    const expiringAt = new Date("2026-10-29T00:10:00.000Z");
    const cookie = Buffer.alloc(32, 2).toString("base64url");
    record.credentials = encryptSessionCredentials(sessionId, userId, credentials, encryptionConfig);
    record.accessTokenExpiresAt = "2026-10-29T00:09:00.000Z";
    let refreshCalls = 0;
    store.failClosedRefreshLease = async (input) => { calls.failClosed = input; return true; };
    const service = createSessionService({
        store,
        getEncryptionConfig: () => encryptionConfig,
        now: () => expiringAt,
        makeId: () => "123e4567-e89b-42d3-a456-426614174010",
        refreshCredentials: async () => { refreshCalls += 1; throw new Error("network timeout after dispatch"); }
    });

    const resolved = await service.resolveSession(cookie, expiringAt);

    assert.equal(resolved, null);
    assert.equal(refreshCalls, 1);
    assert.equal(calls.failClosed.leaseId, "123e4567-e89b-42d3-a456-426614174010");
});
