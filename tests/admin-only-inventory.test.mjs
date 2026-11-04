import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: roomRouter }, { default: tableRouter }, { default: restaurantRouter }, { default: mediaRouter }, { default: reservationRouter }, { default: combinedRouter }] = await Promise.all([
    import("../dist/routes/room.routes.js"),
    import("../dist/routes/table.routes.js"),
    import("../dist/routes/restaurant.routes.js"),
    import("../dist/routes/media.routes.js"),
    import("../dist/routes/reservation.routes.js"),
    import("../dist/routes/combined-booking.routes.js"),
]);

const response = () => ({ statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const invoke = (handler, roleName) => {
    const res = response();
    let nextCalled = false;
    handler({ auth: { roleName }, params: {}, body: {} }, res, () => { nextCalled = true; });
    return { ...res, nextCalled };
};
const routeFor = (router, path, method) => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;

const adminOnly = [
    ["room POST", roomRouter, "/", "post", 1], ["room PUT", roomRouter, "/:id", "put", 1], ["room DELETE", roomRouter, "/:id", "delete", 1],
    ["room amenity POST", roomRouter, "/:roomId/amenities", "post", 1], ["room amenity DELETE", roomRouter, "/:roomId/amenities/:amenityId", "delete", 1],
    ["table POST", tableRouter, "/", "post", 1], ["table PUT", tableRouter, "/:id", "put", 1], ["table DELETE", tableRouter, "/:id", "delete", 1],
    ["restaurant PUT", restaurantRouter, "/:id", "put", 1],
    ["restaurant amenity POST", restaurantRouter, "/:restaurantId/amenities", "post", 1], ["restaurant amenity DELETE", restaurantRouter, "/:restaurantId/amenities/:amenityId", "delete", 1],
    ["media POST", mediaRouter, "/:entityType/:entityId", "post", 0], ["media PUT file", mediaRouter, "/:id/file", "put", 0],
    ["media primary PATCH", mediaRouter, "/:id/primary", "patch", 0], ["media order PATCH", mediaRouter, "/:id/order", "patch", 0], ["media DELETE", mediaRouter, "/:id", "delete", 0],
];

for (const [label, router, path, method, guardIndex] of adminOnly) {
    test(`Staff receives 403 for ${label}`, () => {
        const route = routeFor(router, path, method);
        assert.ok(route, `${method.toUpperCase()} ${path} exists`);
        const result = invoke(route.stack[guardIndex].handle, "Staff");
        assert.equal(result.statusCode, 403);
        assert.equal(result.body.message, "Insufficient permissions");
        assert.equal(result.nextCalled, false);
    });
}

for (const [label, router] of [["reservation", reservationRouter], ["combined booking", combinedRouter]]) {
    test(`Staff retains ${label} status PATCH access`, () => {
        const route = routeFor(router, "/:id/status", "patch");
        assert.ok(route);
        const result = invoke(route.stack[0].handle, "Staff");
        assert.equal(result.statusCode, 200);
        assert.equal(result.nextCalled, true);
    });
}
