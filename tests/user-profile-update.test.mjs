import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { updateCurrentUserController } = await import("../dist/controllers/user.controller.js");

const invokeController = async (body, fetchHandler) => {
    const originalFetch = globalThis.fetch;
    const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    globalThis.fetch = fetchHandler;
    try {
        await updateCurrentUserController({ body, auth: { accessToken: "verified-token" } }, response);
    } finally {
        globalThis.fetch = originalFetch;
    }
    return response;
};

const noDatabaseRequest = async () => {
    throw new Error("Rejected profile payload must not reach Supabase");
};

for (const [field, value] of [
    ["role_id", 1],
    ["user_id", "another-user"],
    ["unknown_field", "unexpected"],
]) {
    test(`profile update rejects non-allowlisted ${field}`, async () => {
        const response = await invokeController({ first_name: "Ada", [field]: value }, noDatabaseRequest);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /not allowed/i);
    });
}

test("profile update rejects an empty body", async () => {
    const response = await invokeController({}, noDatabaseRequest);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /at least one field/i);
});

test("profile update rejects non-string values and overlong strings", async () => {
    const nonString = await invokeController({ first_name: 42 }, noDatabaseRequest);
    const overlong = await invokeController({ first_name: "a".repeat(101) }, noDatabaseRequest);

    assert.equal(nonString.statusCode, 400);
    assert.match(nonString.body.message, /must be a string/i);
    assert.equal(overlong.statusCode, 400);
    assert.match(overlong.body.message, /100 characters or fewer/i);
});

test("profile update accepts allowed fields and preserves returned profile shape", async () => {
    let updatePayload;
    const updatedProfile = { user_id: "user-1", first_name: "Ada", last_name: "Lovelace", phone: "555", role_id: 3 };
    const response = await invokeController(
        { first_name: "  Ada  ", last_name: " Lovelace ", phone: " 555 " },
        async (input, init = {}) => {
            const url = String(input);
            if (url.endsWith("/auth/v1/user")) {
                return new Response(JSON.stringify({ id: "user-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            if (url.includes("/rest/v1/user?")) {
                updatePayload = JSON.parse(init.body);
                return new Response(JSON.stringify(updatedProfile), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } });
            }
            throw new Error(`Unexpected request: ${url}`);
        },
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(updatePayload, { first_name: "Ada", last_name: "Lovelace", phone: "555" });
    assert.deepEqual(response.body, updatedProfile);
});
