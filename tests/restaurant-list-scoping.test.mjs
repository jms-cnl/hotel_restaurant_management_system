import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { getRestaurantsController } = await import("../dist/controllers/restaurant.controller.js");

const assigned = { restaurant_id: 7, name: "Assigned Cafe" };
const unassigned = { restaurant_id: 8, name: "Other Cafe" };
const response = (body) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": `0-${Math.max(0, body.length - 1)}/${body.length}` },
});

const request = (roleName) => ({
    params: {}, query: {}, body: {}, headers: {},
    ...(roleName ? { auth: { roleName, user: { id: "00000000-0000-4000-8000-000000000001" }, accessToken: "verified-user-token" } } : {}),
});

const invoke = async (req) => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    await getRestaurantsController(req, res);
    return res;
};

test("Staff restaurant list is limited to assigned restaurant ids in the database query", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        calls.push({ table, url });
        if (table === "staff_restaurant_assignment") return response([{ restaurant_id: 7 }]);
        if (table === "restaurant") {
            const filter = url.searchParams.get("restaurant_id") ?? "";
            const ids = filter.replace(/^in\./, "").replace(/[()]/g, "").split(",").map(Number);
            assert.deepEqual(ids, [7]);
            return response([assigned]);
        }
        throw new Error(`Unexpected request ${url}`);
    };

    try {
        const result = await invoke(request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [assigned]);
        assert.deepEqual(calls.map(({ table }) => table), ["staff_restaurant_assignment", "restaurant"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Staff with no assignments receive an empty list without an empty IN query", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        calls.push({ table, url });
        if (table === "staff_restaurant_assignment") return response([]);
        throw new Error(`No restaurant query expected: ${url}`);
    };

    try {
        const result = await invoke(request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, []);
        assert.deepEqual(calls.map(({ table }) => table), ["staff_restaurant_assignment"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Admin restaurant list remains unscoped", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.pathname.endsWith("/restaurant")) return response([assigned, unassigned]);
        throw new Error(`Unexpected request ${url}`);
    };

    try {
        const result = await invoke(request("Admin"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [assigned, unassigned]);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].searchParams.has("restaurant_id"), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("public and Customer restaurant lists remain unscoped", async () => {
    const originalFetch = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.pathname.endsWith("/restaurant")) return response([assigned, unassigned]);
        throw new Error(`Unexpected request ${url}`);
    };

    try {
        for (const req of [request(undefined), request("Customer")]) {
            const result = await invoke(req);
            assert.equal(result.statusCode, 200);
            assert.deepEqual(result.body, [assigned, unassigned]);
        }
        assert.equal(urls.length, 2);
        assert.equal(urls.every((url) => !url.searchParams.has("restaurant_id")), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
