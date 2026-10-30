import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-publishable-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-session-store";
process.env.HRMS_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION = "1";

const routes = (await import("../dist/routes/auth.routes.js")).default;
const controllers = await import("../dist/controllers/auth.controller.js");
const { sessionService } = await import("../dist/services/session.service.js");
const routeFor = (method, path) => routes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);

test("auth routes expose the app and restricted recovery session endpoints", () => {
    for (const [method, path] of [
        ["get", "/session"], ["post", "/csrf"], ["post", "/recovery/exchange"],
        ["get", "/recovery/session"], ["post", "/recovery/csrf"], ["post", "/reset-password"], ["post", "/logout"]
    ]) assert.ok(routeFor(method, path), `${method.toUpperCase()} ${path}`);
    const recoveryStatus = routeFor("get", "/recovery/session").route.stack;
    assert.equal(recoveryStatus.at(-2).handle.name, "requireRecoverySession");
});

test("auth responses omit cookie secret and Supabase credentials", () => {
    const value = controllers.safeAuthResponse({
        user: { id: "user-1", email: "guest@example.com" },
        profile: { user_id: "user-1", role_id: 1, role_name: "Customer" },
        session: {
            cookieSecret: "opaque-cookie-secret", csrfToken: "csrf-value",
            user: { id: "user-1", email: "guest@example.com" },
            profile: { user_id: "user-1", role_id: 1, role_name: "Customer" },
            session: { purpose: "app", scope: "application", idleExpiresAt: "2026-10-29T00:30:00.000Z" },
            credentials: { accessToken: "access-secret", refreshToken: "refresh-secret" }
        }
    });
    const serialized = JSON.stringify(value);
    for (const secret of ["opaque-cookie-secret", "access-secret", "refresh-secret"]) assert.equal(serialized.includes(secret), false);
    assert.equal(value.csrf_token, "csrf-value");
});

test("login cookie is HttpOnly and logout clears the same cookie configuration", () => {
    const calls = [];
    const res = {
        cookie(...args) { calls.push(["set", ...args]); return this; },
        clearCookie(...args) { calls.push(["clear", ...args]); return this; }
    };
    const result = { session: {
        cookieSecret: "raw-cookie-secret",
        session: { idleExpiresAt: new Date(Date.now() + 60_000).toISOString() }
    } };
    controllers.setSessionCookie(res, result);
    controllers.clearSessionCookie(res);
    assert.equal(calls[0][1], "hrm_session");
    assert.equal(calls[0][2], "raw-cookie-secret");
    assert.equal(calls[0][3].httpOnly, true);
    assert.equal(calls[1][1], "hrm_session");
    assert.equal(calls[1][2].httpOnly, true);
    const { maxAge: _maxAge, ...issuedOptions } = calls[0][3];
    assert.deepEqual(calls[1][2], issuedOptions);
});

test("logout revokes only the session attached to the current request", async () => {
    const original = sessionService.revokeCurrentSession;
    const revoked = [];
    sessionService.revokeCurrentSession = async (sessionId) => { revoked.push(sessionId); return true; };
    try {
        await (await import("../dist/services/auth.service.js")).logoutUser({ auth: { sessionId: "current-browser-session" } });
    } finally {
        sessionService.revokeCurrentSession = original;
    }
    assert.deepEqual(revoked, ["current-browser-session"]);
});

test("logout clears the session cookie before sending the response", async () => {
    const originalRevoke = sessionService.revokeCurrentSession;
    const responseEvents = [];
    sessionService.revokeCurrentSession = async () => true;
    const res = {
        clearCookie(name, options) { responseEvents.push(["clear", name, options]); return this; },
        status(code) { responseEvents.push(["status", code]); return this; },
        send() { responseEvents.push(["send"]); return this; }
    };
    try {
        await controllers.logoutController({ auth: { sessionId: "current-browser-session" } }, res);
    } finally {
        sessionService.revokeCurrentSession = originalRevoke;
    }
    assert.equal(responseEvents[0][0], "clear");
    assert.equal(responseEvents.at(-1)[0], "send");
});

test("login calls Supabase Auth, persists an HRMS session, and sends only the cookie and safe profile", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const tokenData = {
        access_token: "supabase-access-secret", refresh_token: "supabase-refresh-secret",
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer",
        user: { id: "123e4567-e89b-42d3-a456-426614174099", email: "customer@example.test", app_metadata: {}, user_metadata: {} }
    };
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const payload = init.body ? JSON.parse(init.body) : null;
        calls.push({ url, method: init.method ?? "GET", payload });
        if (url.pathname === "/auth/v1/token") return new Response(JSON.stringify(tokenData), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.pathname === "/rest/v1/user") return new Response(JSON.stringify({ user_id: tokenData.user.id, role_id: 1, role: { role_name: "Customer" } }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.pathname === "/rest/v1/hrm_sessions" && init.method === "POST") {
            const row = payload;
            return new Response(JSON.stringify({ ...row, revoked_at: null, credentials_version: 0, refresh_state: "idle", refresh_lock_id: null, refresh_lease_until: null, refresh_started_at: null }), { status: 201, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ message: "unexpected mock request" }), { status: 500, headers: { "Content-Type": "application/json" } });
    };
    let responseBody;
    let cookie;
    const res = {
        json(value) { responseBody = value; return this; },
        cookie(...args) { cookie = args; return this; }
    };
    try {
        await controllers.loginController({ body: { email: "customer@example.test", password: "ValidPass1!" } }, res);
    } finally { globalThis.fetch = originalFetch; }
    assert.equal(cookie[0], "hrm_session");
    assert.equal(cookie[2].httpOnly, true);
    assert.equal(responseBody.user.id, tokenData.user.id);
    assert.equal(JSON.stringify(responseBody).includes(tokenData.access_token), false);
    assert.equal(JSON.stringify(responseBody).includes(tokenData.refresh_token), false);
    assert.ok(calls.some(({ url, method }) => url.pathname === "/rest/v1/hrm_sessions" && method === "POST"));
});

test("registration preserves metadata and creates an HRMS session when Supabase Auth returns one", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const user = { id: "123e4567-e89b-42d3-a456-426614174098", email: "new@example.test", app_metadata: {}, user_metadata: {} };
    const tokenData = { access_token: "reg-access-secret", refresh_token: "reg-refresh-secret", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const payload = init.body ? JSON.parse(init.body) : null;
        calls.push({ url, method: init.method ?? "GET", payload });
        if (url.pathname === "/auth/v1/signup") return new Response(JSON.stringify(tokenData), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.pathname === "/rest/v1/user") return new Response(JSON.stringify({ user_id: user.id, role_id: 1, role: { role_name: "Customer" } }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.pathname === "/rest/v1/hrm_sessions" && init.method === "POST") return new Response(JSON.stringify({ ...payload, revoked_at: null, credentials_version: 0, refresh_state: "idle", refresh_lock_id: null, refresh_lease_until: null, refresh_started_at: null }), { status: 201, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ message: "unexpected mock request" }), { status: 500, headers: { "Content-Type": "application/json" } });
    };
    let responseBody;
    let cookie;
    const res = { status() { return this; }, json(value) { responseBody = value; return this; }, cookie(...args) { cookie = args; return this; } };
    try {
        await controllers.registerController({ body: { email: user.email, password: "ValidPass1!", first_name: "New", last_name: "Guest", phone: "555" } }, res);
    } finally { globalThis.fetch = originalFetch; }
    const signup = calls.find(({ url }) => url.pathname === "/auth/v1/signup");
    assert.deepEqual(signup.payload.data, { first_name: "New", last_name: "Guest", phone: "555" });
    assert.equal(cookie[0], "hrm_session");
    assert.equal(responseBody.user.id, user.id);
    assert.equal(JSON.stringify(responseBody).includes(tokenData.access_token), false);
    assert.ok(calls.some(({ url, method }) => url.pathname === "/rest/v1/hrm_sessions" && method === "POST"));
});

test("successful password recovery revokes its session and clears its cookie", async () => {
    const originalFetch = globalThis.fetch;
    const originalRevoke = sessionService.revokeCurrentSession;
    let revokedId;
    let cleared;
    let responseBody;
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "user" }), { status: 200, headers: { "Content-Type": "application/json" } });
    sessionService.revokeCurrentSession = async (id) => { revokedId = id; return true; };
    const res = {
        clearCookie(name, options) { cleared = { name, options }; return this; },
        json(value) { responseBody = value; return this; },
        status() { return this; }
    };
    try {
        await controllers.resetPasswordController({
            auth: { accessToken: "verified-recovery-token", sessionPurpose: "recovery", sessionId: "recovery-session-id" },
            body: { new_password: "ValidPass1!" }
        }, res);
    } finally {
        globalThis.fetch = originalFetch;
        sessionService.revokeCurrentSession = originalRevoke;
    }
    assert.equal(revokedId, "recovery-session-id");
    assert.equal(cleared.name, "hrm_session");
    assert.match(responseBody.message, /sign in again/i);
});
