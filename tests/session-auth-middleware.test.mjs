import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-publishable-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-credential";

const { createAuthenticationMiddleware, requireRecoverySession } = await import("../dist/middleware/auth.middleware.js");
const { requireSessionCsrf } = await import("../dist/middleware/csrf.middleware.js");
const userId = "123e4567-e89b-42d3-a456-426614174001";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const accessToken = "internal-access-token";
const cookieSecret = Buffer.alloc(32, 9).toString("base64url");
const csrfSecret = Buffer.alloc(32, 4).toString("base64url");
const csrfHash = createHash("sha256").update(Buffer.from(csrfSecret, "base64url")).digest();
const now = new Date("2026-10-29T00:10:00.000Z");

function makeResponse() {
    return {
        statusCode: undefined,
        body: undefined,
        cookies: [],
        clearedCookies: [],
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        cookie(...args) { this.cookies.push(args); return this; },
        clearCookie(...args) { this.clearedCookies.push(args); return this; }
    };
}

function makeReq({ method = "GET", cookie = `hrm_session=${cookieSecret}`, authorization, path = "/api/users/me", originalUrl = path, baseUrl = "" } = {}) {
    const headers = {};
    if (cookie !== null && cookie !== undefined) headers.cookie = cookie;
    if (authorization) headers.authorization = authorization;
    return {
        method,
        headers,
        get(name) { return headers[name.toLowerCase()]; },
        path,
        originalUrl,
        baseUrl,
        body: {},
        query: {},
        params: {}
    };
}

function makeResolvedSession(overrides = {}) {
    return {
        session: {
            sessionId,
            userId,
            purpose: "app",
            scope: "application",
            accessTokenExpiresAt: "2026-10-29T01:00:00.000Z",
            createdAt: "2026-10-29T00:00:00.000Z",
            lastActivityAt: "2026-10-29T00:00:00.000Z",
            idleExpiresAt: "2026-10-29T00:30:00.000Z",
            credentialsVersion: 0,
            refreshState: "idle",
            refreshLockId: null,
            refreshLeaseUntil: null
        },
        credentials: { accessToken, refreshToken: "server-only-refresh-token" },
        csrfTokenHash: csrfHash,
        ...overrides
    };
}

function makeDependencies(overrides = {}) {
    const calls = {};
    const client = {
        auth: { async getUser(token) { calls.getUserToken = token; return { data: { user: { id: userId, email: "customer@example.test" } }, error: null }; } },
        from(table) {
            calls.table = table;
            return {
                select(columns) {
                    calls.columns = columns;
                    return { eq(column, value) { calls.profileFilter = [column, value]; return { async single() { return { data: { user_id: userId, role_id: 1, role: { role_name: "Customer" } }, error: null }; } }; } };
                }
            };
        }
    };
    const dependencies = {
        now: () => now,
        resolveSession: async (cookie, _now, options) => { calls.cookie = cookie; calls.allowRecovery = options.allowRecovery; return makeResolvedSession(); },
        revokeCurrentSession: async (id) => { calls.revoked = id; return true; },
        recordMeaningfulActivity: async (id) => { calls.activity = id; return true; },
        getRequestSupabase: (_req, token) => { calls.supabaseToken = token; return client; },
        runWithRequest: (_req, callback) => callback(),
        getProfile: async (_clientArg, id) => { calls.profileUserId = id; return { profile: { user_id: userId, role_id: 1, role: { role_name: "Customer" } }, error: null }; },
        ...overrides
    };
    return { dependencies, calls };
}

test("authenticates an opaque cookie and keeps the recovered access token internal", async () => {
    const { dependencies, calls } = makeDependencies();
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const req = makeReq();
    const res = makeResponse();
    let continued = false;

    await middleware(req, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(calls.cookie, cookieSecret);
    assert.equal(calls.supabaseToken, accessToken);
    assert.equal(req.auth.user.id, userId);
    assert.equal(req.auth.accessToken, accessToken);
    assert.equal(req.auth.refreshToken, undefined);
    assert.equal(req.auth.authMethod, "session_cookie");
    assert.equal(JSON.stringify(req.auth).includes(accessToken), false);
    assert.equal(JSON.stringify(req.auth).includes("csrfTokenHash"), false);
});

test("an invalid session cookie blocks bearer fallback", async () => {
    const { dependencies, calls } = makeDependencies({ resolveSession: async () => null });
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const req = makeReq({ authorization: "Bearer legacy-token" });
    const res = makeResponse();

    await middleware(req, res, () => assert.fail("next must not be called"));

    assert.equal(res.statusCode, 401);
    assert.equal(calls.supabaseToken, undefined);
    assert.equal(res.clearedCookies[0][0], "hrm_session");
    assert.equal(res.clearedCookies[0][1].path, "/");
});

test("malformed session cookies return 401 and are cleared", async () => {
    const { dependencies } = makeDependencies();
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const res = makeResponse();

    await middleware(makeReq({ cookie: "hrm_session=%E0%A4%A" }), res, () => assert.fail("next must not be called"));

    assert.equal(res.statusCode, 401);
    assert.equal(res.clearedCookies[0][0], "hrm_session");
    assert.equal(res.clearedCookies[0][1].httpOnly, true);
});

test("recovery authentication clears stale session cookies on 401", async () => {
    const { dependencies } = makeDependencies({ resolveSession: async () => null });
    const middleware = createAuthenticationMiddleware({ allowRecovery: true }, dependencies);
    const res = makeResponse();

    await middleware(makeReq(), res, () => assert.fail("next must not be called"));

    assert.equal(res.statusCode, 401);
    assert.equal(res.clearedCookies[0][0], "hrm_session");
});

test("enforces the current profile role's idle timeout and revokes expired sessions", async () => {
    const expiredSession = makeResolvedSession({
        session: { ...makeResolvedSession().session, lastActivityAt: "2026-10-29T00:00:00.000Z" }
    });
    const { dependencies, calls } = makeDependencies({
        now: () => new Date("2026-10-29T00:15:00.001Z"),
        resolveSession: async () => expiredSession,
        getProfile: async () => ({ profile: { user_id: userId, role_id: 2, role: { role_name: "Staff" } }, error: null })
    });
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const res = makeResponse();

    await middleware(makeReq(), res, () => assert.fail("next must not be called"));

    assert.equal(res.statusCode, 401);
    assert.equal(calls.revoked, sessionId);
    assert.equal(res.clearedCookies[0][0], "hrm_session");
});

test("permits legacy bearer requests temporarily when no session cookie is present", async () => {
    const { dependencies, calls } = makeDependencies();
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const req = makeReq({ cookie: null, authorization: "Bearer legacy-access-token" });
    const res = makeResponse();
    let continued = false;

    await middleware(req, res, () => { continued = true; });

    assert.equal(continued, true);
    assert.equal(calls.supabaseToken, "legacy-access-token");
    assert.equal(req.auth.authMethod, "legacy_bearer");
});

test("rejects recovery sessions from ordinary routes without clearing or revoking them", async () => {
    const { dependencies, calls } = makeDependencies({
        resolveSession: async (_cookie, _now, options) => {
            calls.allowRecovery = options.allowRecovery;
            return options.allowRecovery ? makeResolvedSession({
                session: { ...makeResolvedSession().session, purpose: "recovery", scope: "password_reset" }
            }) : null;
        }
    });
    const ordinary = createAuthenticationMiddleware({}, dependencies);
    const res = makeResponse();
    await ordinary(makeReq(), res, () => assert.fail("recovery session must be rejected"));
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { message: "Recovery sessions cannot access application routes" });
    assert.deepEqual(res.clearedCookies, []);
    assert.equal(calls.revoked, undefined);
    assert.equal(calls.allowRecovery, true);

    const recovery = createAuthenticationMiddleware({ allowRecovery: true }, dependencies);
    const recoveryReq = makeReq({ method: "POST", path: "/api/auth/reset-password" });
    recoveryReq.headers["x-csrf-token"] = csrfSecret;
    const recoveryRes = makeResponse();
    let continued = false;
    await recovery(recoveryReq, recoveryRes, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(recoveryRes.statusCode, undefined);

    let recoveryGuardContinued = false;
    requireRecoverySession(recoveryReq, makeResponse(), () => { recoveryGuardContinued = true; });
    assert.equal(recoveryGuardContinued, true);
});

test("requires the session-bound CSRF token for state-changing cookie-authenticated requests", () => {
    const req = makeReq({ method: "POST" });
    req.auth = { authMethod: "session_cookie", csrfTokenHash: csrfHash };
    const res = makeResponse();
    let continued = false;

    requireSessionCsrf(req, res, () => { continued = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);

    req.headers["x-csrf-token"] = csrfSecret;
    requireSessionCsrf(req, makeResponse(), () => { continued = true; });
    assert.equal(continued, true);
});

test("background polling does not update activity or extend the cookie", async () => {
    const { dependencies, calls } = makeDependencies();
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const res = makeResponse();
    let continued = false;
    await middleware(makeReq({ method: "GET", path: "/api/reservations/poll" }), res, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(calls.activity, undefined);
    assert.equal(res.statusCode, undefined);
});

test("valid state-changing requests extend idle activity using the current profile role", async () => {
    const activity = [];
    const { dependencies } = makeDependencies({
        getProfile: async () => ({ profile: { user_id: userId, role_id: 3, role: { role_name: "Admin" } }, error: null }),
        recordMeaningfulActivity: async (...args) => { activity.push(args); return true; }
    });
    const middleware = createAuthenticationMiddleware({}, dependencies);
    const req = makeReq({ method: "POST" });
    req.headers["x-csrf-token"] = csrfSecret;
    const res = makeResponse();
    let continued = false;
    await middleware(req, res, () => { continued = true; });
    assert.equal(continued, true);
    assert.deepEqual(activity, [[sessionId, "Admin", now]]);
});

test("logout and password reset do not refresh the cookie or extend session activity", async () => {
    for (const path of ["/api/auth/logout", "/api/auth/reset-password"]) {
        const activity = [];
        const { dependencies } = makeDependencies({
            recordMeaningfulActivity: async (...args) => { activity.push(args); return true; }
        });
        const middleware = createAuthenticationMiddleware({ allowRecovery: true }, dependencies);
        const req = makeReq({ method: "POST", path, originalUrl: path });
        req.headers["x-csrf-token"] = csrfSecret;
        const res = makeResponse();
        let continued = false;

        await middleware(req, res, () => { continued = true; });

        assert.equal(continued, true, `${path} should reach its revocation controller`);
        assert.deepEqual(activity, [], `${path} must not extend session activity`);
        assert.deepEqual(res.cookies, [], `${path} must not re-issue the session cookie`);
    }
});

test("session refresh cookie max-age follows the authenticated role idle timeout", async () => {
    for (const [roleName, expectedMaxAge] of [["Customer", 1_800_000], ["Staff", 900_000], ["Admin", 900_000]]) {
        const { dependencies } = makeDependencies({
            getProfile: async () => ({ profile: { user_id: userId, role_id: 1, role: { role_name: roleName } }, error: null })
        });
        const middleware = createAuthenticationMiddleware({}, dependencies);
        const req = makeReq({ method: "POST" });
        req.headers["x-csrf-token"] = csrfSecret;
        const res = makeResponse();

        await middleware(req, res, () => undefined);

        assert.equal(res.cookies[0][2].maxAge, expectedMaxAge, `${roleName} cookie max-age`);
    }
});
