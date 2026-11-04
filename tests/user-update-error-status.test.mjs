import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { updateCurrentUserController } = await import("../dist/controllers/user.controller.js");

const invoke = async (status, payload) => {
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const logged = [];
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    globalThis.fetch = async (input) => String(input).endsWith("/auth/v1/user")
        ? new Response(JSON.stringify({ id: "user-1" }), { status: 200 })
        : new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
    console.error = (...args) => logged.push(args);
    try {
        await updateCurrentUserController({ body: { first_name: "Ada" }, auth: { accessToken: "verified-token" } }, res);
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
    }
    return { res, logged };
};

for (const [name, status, payload, expected] of [
    ["validation", 400, { code: "23514", message: "private validation detail" }, 400],
    ["forbidden", 403, { code: "42501", message: "private authorization detail" }, 403],
    ["not found", 406, { code: "PGRST116", details: "The result contains 0 rows", message: "private not-found detail" }, 404],
    ["unexpected", 500, { code: "XX000", message: "private database detail" }, 500],
]) {
    test(`profile update maps ${name} errors to a safe response`, async () => {
        const { res, logged } = await invoke(status, payload);
        assert.equal(res.statusCode, expected);
        assert.equal(typeof res.body.message, "string");
        assert.equal(JSON.stringify(res.body).includes("private"), false);
        assert.ok(logged.length > 0);
        assert.match(JSON.stringify(logged), /private/);
    });
}
