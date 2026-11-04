import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-auth";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-session-store";
process.env.HRMS_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION = "1";
process.env.CORS_ORIGINS = "https://app.example.test";

const routes = (await import("../dist/routes/auth.routes.js")).default;
const { sessionService } = await import("../dist/services/session.service.js");
const { sessionCookieOptions } = await import("../dist/config/session-cookie.js");
const userId = "123e4567-e89b-42d3-a456-426614174001";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const csrfToken = Buffer.alloc(32, 8).toString("base64url");
const csrfTokenHash = createHash("sha256").update(Buffer.from(csrfToken, "base64url")).digest();
const session = {
    session: {
        sessionId, userId, purpose: "app", scope: "application",
        accessTokenExpiresAt: "2026-11-04T01:00:00.000Z",
        createdAt: "2026-11-04T00:00:00.000Z",
        lastActivityAt: new Date().toISOString(), idleExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        credentialsVersion: 0, refreshState: "idle", refreshLockId: null, refreshLeaseUntil: null,
    },
    credentials: { accessToken: "valid-access-token", refreshToken: "server-refresh-token" },
    csrfTokenHash,
};

const routeFor = (path) => routes.stack.find((layer) => layer.route?.path === path && layer.route.methods.post)?.route;
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const makeRequest = ({ path, cookie = "hrm_session=stale-cookie", csrf = undefined } = {}) => {
    const headers = { origin: "https://app.example.test" };
    if (cookie !== null) headers.cookie = cookie;
    if (csrf !== undefined) headers["x-csrf-token"] = csrf;
    return {
        method: "POST", path, originalUrl: `/api/auth${path}`, baseUrl: "/api/auth", params: {}, query: {}, body: {}, headers,
        get(name) { return headers[name.toLowerCase()]; },
    };
};

const makeResponse = () => ({
    statusCode: 200, body: undefined, clearedCookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    clearCookie(...args) { this.clearedCookies.push(args); return this; },
    cookie() { return this; },
});

const invokeRoute = async (path, req, res) => {
    const route = routeFor(path);
    assert.ok(route, `POST /api/auth${path} exists`);
    const dispatch = async (index) => {
        if (index >= route.stack.length) return;
        const advanced = await new Promise((resolve, reject) => {
            try {
                Promise.resolve(route.stack[index].handle(req, res, (error) => error ? reject(error) : resolve(true)))
                    .then(() => resolve(false), reject);
            } catch (error) { reject(error); }
        });
        if (advanced) await dispatch(index + 1);
    };
    await dispatch(0);
};

const withAuthState = async (resolveSession, action) => {
    const originalResolve = sessionService.resolveSession;
    const originalRevoke = sessionService.revokeCurrentSession;
    const originalFetch = globalThis.fetch;
    sessionService.resolveSession = resolveSession;
    sessionService.revokeCurrentSession = async () => true;
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId, email: "guest@example.test" });
        if (url.pathname === "/rest/v1/user") return jsonResponse({ user_id: userId, role_id: 1, role: { role_name: "Customer" } });
        throw new Error(`Unexpected request ${url}`);
    };
    try { await action(); }
    finally {
        sessionService.resolveSession = originalResolve;
        sessionService.revokeCurrentSession = originalRevoke;
        globalThis.fetch = originalFetch;
    }
};

test("POST /auth/csrf rejects a stale cookie with 401 and clears it", async () => {
    await withAuthState(async () => null, async () => {
        const res = makeResponse();
        await invokeRoute("/csrf", makeRequest({ path: "/csrf" }), res);
        assert.equal(res.statusCode, 401);
        assert.equal(res.clearedCookies[0][0], "hrm_session");
        assert.deepEqual(res.clearedCookies[0][1], sessionCookieOptions());
    });
});

for (const cookie of ["hrm_session=stale-cookie", null]) {
    test(`POST /auth/logout returns 204 and clears cookie when session is absent or stale (${cookie ?? "missing cookie"})`, async () => {
        await withAuthState(async () => null, async () => {
            const res = makeResponse();
            await invokeRoute("/logout", makeRequest({ path: "/logout", cookie }), res);
            assert.equal(res.statusCode, 204);
            assert.equal(res.body, undefined);
            assert.equal(res.clearedCookies[0][0], "hrm_session");
            assert.deepEqual(res.clearedCookies[0][1], sessionCookieOptions());
        });
    });
}

test("POST /auth/logout requires CSRF for a valid cookie session", async () => {
    await withAuthState(async () => session, async () => {
        const res = makeResponse();
        await invokeRoute("/logout", makeRequest({ path: "/logout", csrf: undefined }), res);
        assert.equal(res.statusCode, 403);
    });
});

test("POST /auth/logout succeeds with a valid cookie session and CSRF token", async () => {
    await withAuthState(async () => session, async () => {
        const res = makeResponse();
        await invokeRoute("/logout", makeRequest({ path: "/logout", csrf: csrfToken }), res);
        assert.equal(res.statusCode, 204);
        assert.equal(res.body, undefined);
        assert.equal(res.clearedCookies[0][0], "hrm_session");
    });
});

test("POST /auth/logout keeps invalid bearer authentication at 401", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonResponse({ message: "Invalid token" }, 401);
    try {
        const req = makeRequest({ path: "/logout", cookie: null });
        req.headers.authorization = "Bearer invalid-token";
        const res = makeResponse();
        await invokeRoute("/logout", req, res);
        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.clearedCookies, []);
    } finally { globalThis.fetch = originalFetch; }
});
