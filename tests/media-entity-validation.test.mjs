import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { getMedia } = await import("../dist/services/media.service.js");

test("media entity parsing rejects inherited property names", async () => {
    const originalFetch = globalThis.fetch;
    let databaseCalled = false;
    globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
    try {
        await assert.rejects(getMedia("toString", 7), (error) =>
            error.name === "MediaError" && error.statusCode === 400 && error.message === "Invalid media entity");
        assert.equal(databaseCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
