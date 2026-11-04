import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: hotelRouter }, { default: mediaRouter }, authMiddleware] = await Promise.all([
    import("../dist/routes/hotel.routes.js"),
    import("../dist/routes/media.routes.js"),
    import("../dist/middleware/auth.middleware.js"),
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
        const result = await invoke(route.stack[1].handle, request("Staff"));
        assert.equal(result.statusCode, 403);
        assert.equal(result.nextCalled, false);
    });

    test(`Admin is allowed to hotel ${method.toUpperCase()} ${path}`, async () => {
        const route = findRoute(hotelRouter, path, method);
        assert.ok(route);
        const result = await invoke(route.stack[1].handle, request("Admin"));
        assert.equal(result.statusCode, 200);
        assert.equal(result.nextCalled, true);
    });
}

test("hotel GET routes use optional auth without a role guard", () => {
    for (const path of ["/", "/:id"]) {
        const route = findRoute(hotelRouter, path, "get");
        assert.ok(route);
        assert.equal(route.stack.length, 2);
        assert.equal(route.stack[0].handle, authMiddleware.optionalAuthenticate);
    }
});

test("Staff cannot upload any entity media", async () => {
    const route = findRoute(mediaRouter, "/:entityType/:entityId", "post");
    assert.ok(route);
    for (const entityType of ["hotel", "restaurant", "room", "table"]) {
        const result = await invoke(route.stack[0].handle, request("Staff", { entityType, entityId: "5" }));
        assert.equal(result.statusCode, 403);
        assert.equal(result.nextCalled, false);
    }
});
