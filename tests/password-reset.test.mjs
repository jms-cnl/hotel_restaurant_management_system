import assert from "node:assert/strict";
import test from "node:test";
import { requireRecoveryToken } from "../dist/middleware/auth.middleware.js";

process.env.SUPABASE_URL = "https://project.supabase.co";
process.env.SUPABASE_KEY = "test-public-key";

const { resetPassword } = await import("../dist/services/auth.service.js");
const authRoutes = (await import("../dist/routes/auth.routes.js")).default;

test("the reset route verifies authentication before requiring a recovery token", () => {
    const resetRoute = authRoutes.stack.find((layer) => layer.route?.path === "/reset-password");

    assert.ok(resetRoute);
    assert.deepEqual(resetRoute.route.stack.map((layer) => layer.handle.name), [
        "authenticate",
        "requireRecoveryToken",
        "resetPasswordController"
    ]);
});

test("password reset rejects an ordinary signed-in session", () => {
    const payload = Buffer.from(JSON.stringify({ amr: [{ method: "password" }] })).toString("base64url");
    const req = { headers: { authorization: `Bearer header.${payload}.signature` } };
    let status;
    let body;
    let continued = false;
    const res = {
        status(code) { status = code; return this; },
        json(value) { body = value; }
    };

    requireRecoveryToken(req, res, () => { continued = true; });

    assert.equal(status, 403);
    assert.equal(body.message, "Password reset requires a recovery link");
    assert.equal(continued, false);
});

test("password reset accepts a recovery session", () => {
    const payload = Buffer.from(JSON.stringify({ amr: [{ method: "recovery" }] })).toString("base64url");
    const req = { headers: { authorization: `Bearer header.${payload}.signature` } };
    let continued = false;

    requireRecoveryToken(req, { status() { return this; }, json() {} }, () => { continued = true; });

    assert.equal(continued, true);
});

test("password reset updates the Auth user with the request bearer token", async () => {
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
            { headers: { authorization: "Bearer recovery-access-token" } },
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
