import assert from "node:assert/strict";
import test from "node:test";
process.env.SUPABASE_URL = "https://project.supabase.co";
process.env.SUPABASE_KEY = "test-public-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-session-store";

const { authenticateRecovery, requireRecoverySession } = await import("../dist/middleware/auth.middleware.js");
const { resetPassword } = await import("../dist/services/auth.service.js");
const authRoutes = (await import("../dist/routes/auth.routes.js")).default;

test("the reset route verifies authentication before requiring a recovery token", () => {
    const resetRoute = authRoutes.stack.find((layer) => layer.route?.path === "/reset-password");

    assert.ok(resetRoute);
    assert.equal(resetRoute.route.stack[0].handle, authenticateRecovery);
    assert.equal(resetRoute.route.stack[1].handle, requireRecoverySession);
    assert.equal(resetRoute.route.stack[2].handle.name, "resetPasswordController");
});

test("password reset rejects an ordinary signed-in session", () => {
    const req = { auth: { sessionPurpose: "app", sessionScope: "application" } };
    let status;
    let body;
    let continued = false;
    const res = {
        status(code) { status = code; return this; },
        json(value) { body = value; }
    };

    requireRecoverySession(req, res, () => { continued = true; });

    assert.equal(status, 403);
    assert.equal(body.message, "A restricted recovery session is required");
    assert.equal(continued, false);
});

test("password reset accepts a recovery session", () => {
    const req = { auth: { sessionPurpose: "recovery", sessionScope: "password_reset" } };
    let continued = false;

    requireRecoverySession(req, { status() { return this; }, json() {} }, () => { continued = true; });

    assert.equal(continued, true);
});

test("password reset updates the Auth user with the validated recovery session token", async () => {
    const originalFetch = globalThis.fetch;
    let request;

    globalThis.fetch = async (input, init) => {
        request = {
            url: String(input),
            method: init.method,
            headers: new Headers(init.headers),
            body: init.body
        };
        return new Response(JSON.stringify({ user: { id: "user-id" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    try {
        await resetPassword(
            { auth: { accessToken: "recovery-access-token", sessionPurpose: "recovery" } },
            "ValidPass1!"
        );

        assert.equal(request.url, "https://project.supabase.co/auth/v1/user");
        assert.equal(request.method, "PUT");
        assert.equal(request.headers.get("apikey"), "test-public-key");
        assert.equal(request.headers.get("Authorization"), "Bearer recovery-access-token");
        assert.deepEqual(JSON.parse(request.body), { password: "ValidPass1!" });
    } finally {
        globalThis.fetch = originalFetch;
    }
});
