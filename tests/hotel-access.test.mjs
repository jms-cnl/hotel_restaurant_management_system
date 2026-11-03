import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: hotelRouter }, { default: mediaRouter }] = await Promise.all([
    import("../dist/routes/hotel.routes.js"),
    import("../dist/routes/media.routes.js"),
]);

const findRoute = (router, path, method) => router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
)?.route;

const invoke = async (handler, req) => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    return { ...res, nextCalled };
};

const request = (roleName, params = {}) => ({
    params,
    body: {},
    auth: { roleName, accessToken: "verified-user-token" },
});

for (const [path, method] of [["/", "post"], ["/:id", "put"], ["/:id", "delete"]]) {
    test(`Staff is forbidden from hotel ${method.toUpperCase()} ${path}`, async () => {
        const route = findRoute(hotelRouter, path, method);
        assert.ok(route);
        const result = await invoke(route.stack[0].handle, request("Staff"));
        assert.equal(result.statusCode, 403);
        assert.equal(result.nextCalled, false);
    });

    test(`Admin is allowed to hotel ${method.toUpperCase()} ${path}`, async () => {
        const route = findRoute(hotelRouter, path, method);
        assert.ok(route);
        const result = await invoke(route.stack[0].handle, request("Admin"));
        assert.equal(result.statusCode, 200);
        assert.equal(result.nextCalled, true);
    });
}

test("hotel GET routes remain unguarded at the route level", () => {
    for (const path of ["/", "/:id"]) {
        const route = findRoute(hotelRouter, path, "get");
        assert.ok(route);
        assert.equal(route.stack.length, 1);
    }
});

test("Staff cannot upload hotel media but can upload other entity media", async () => {
    const route = findRoute(mediaRouter, "/:entityType/:entityId", "post");
    assert.ok(route);
    const guard = route.stack[0].handle;

    const hotelResult = await invoke(guard, request("Staff", { entityType: "hotel", entityId: "5" }));
    const roomResult = await invoke(guard, request("Staff", { entityType: "room", entityId: "5" }));
    const restaurantResult = await invoke(guard, request("Staff", { entityType: "restaurant", entityId: "5" }));
    const tableResult = await invoke(guard, request("Staff", { entityType: "table", entityId: "5" }));

    assert.equal(hotelResult.statusCode, 403);
    assert.equal(hotelResult.nextCalled, false);
    for (const result of [roomResult, restaurantResult, tableResult]) {
        assert.equal(result.statusCode, 200);
        assert.equal(result.nextCalled, true);
    }
});

test("Admin can upload hotel media", async () => {
    const route = findRoute(mediaRouter, "/:entityType/:entityId", "post");
    assert.ok(route);
    const result = await invoke(route.stack[0].handle, request("Admin", { entityType: "hotel", entityId: "5" }));
    assert.equal(result.statusCode, 200);
    assert.equal(result.nextCalled, true);
});

for (const [path, method] of [["/:id/file", "put"], ["/:id/primary", "patch"], ["/:id/order", "patch"], ["/:id", "delete"]]) {
    test(`Staff hotel media ${method.toUpperCase()} ${path} is forbidden`, async () => {
        const route = findRoute(mediaRouter, path, method);
        assert.ok(route);
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => new Response(JSON.stringify({ hotel_id: 12 }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
        });
        try {
            const roleResult = await invoke(route.stack[0].handle, request("Staff"));
            assert.equal(roleResult.statusCode, 200);
            assert.equal(roleResult.nextCalled, true);

            const entityResult = await invoke(route.stack[1].handle, request("Staff", { id: "91" }));
            assert.equal(entityResult.statusCode, 403);
            assert.equal(entityResult.body.message, "Insufficient permissions");
            assert.equal(entityResult.nextCalled, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test(`Admin may write hotel media with ${method.toUpperCase()} ${path}`, async () => {
        const route = findRoute(mediaRouter, path, method);
        assert.ok(route);
        const roleResult = await invoke(route.stack[0].handle, request("Admin"));
        assert.equal(roleResult.statusCode, 200);
        assert.equal(roleResult.nextCalled, true);

        const entityResult = await invoke(route.stack[1].handle, request("Admin", { id: "91" }));
        assert.equal(entityResult.statusCode, 200);
        assert.equal(entityResult.nextCalled, true);
    });
}

test("Staff may update media IDs that do not belong to hotels", async () => {
    const route = findRoute(mediaRouter, "/:id/primary", "patch");
    assert.ok(route);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ hotel_id: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
    });
    try {
        const result = await invoke(route.stack[1].handle, request("Staff", { id: "92" }));
        assert.equal(result.statusCode, 200);
        assert.equal(result.nextCalled, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
