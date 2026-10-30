import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { createUserScopedSupabase } = await import("../dist/config/supabase.js");

test("business-data requests carry the authenticated user's token with the publishable key", async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (input, init = {}) => {
        request = { url: String(input), headers: new Headers(init.headers) };
        return new Response(JSON.stringify([{ user_id: "user-1" }]), {
            status: 200,
            headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" }
        });
    };

    try {
        const client = createUserScopedSupabase("verified-user-access-token");
        await client.from("user").select("user_id").eq("user_id", "user-1");
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(request.url, "https://example.supabase.co/rest/v1/user?select=user_id&user_id=eq.user-1");
    assert.equal(request.headers.get("Authorization"), "Bearer verified-user-access-token");
    assert.equal(request.headers.get("apikey"), "sb_publishable_test-business-data");
    assert.notEqual(request.headers.get("apikey"), "service-role-credential");
});
