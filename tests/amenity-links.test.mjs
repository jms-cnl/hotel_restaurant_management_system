import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [roomRouter, restaurantRouter, amenitiesRouter, controller, accessMiddleware, authMiddleware, authConfig] = await Promise.all([
    import("../dist/routes/room.routes.js"),
    import("../dist/routes/restaurant.routes.js"),
    import("../dist/routes/amenity.routes.js"),
    import("../dist/controllers/amenity-link.controller.js"),
    import("../dist/middleware/restaurant-amenity-access.middleware.js"),
    import("../dist/middleware/auth.middleware.js"),
    import("../dist/config/session-cookie.js"),
]);

const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const amenity = { amenity_id: 9, hotel_id: 4, name: "Pool", description: "Outdoor" };
const response = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});
const request = (params = {}, roleName = "Admin", body = {}, query = {}) => ({
    params, query, body, headers: {}, auth: { roleName, user: { id: ADMIN_ID }, accessToken: "request-token" },
});
const invoke = async (handler, req) => {
    const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send() { return this; } };
    const oldError = console.error;
    console.error = () => undefined;
    try { await handler(req, res); } finally { console.error = oldError; }
    return res;
};

const fakeDb = ({ parentMissing = false, amenityMissing = false, crossHotel = false, existingLink = false, linkMissing = false, assignment = false, uniqueViolation = false } = {}) => {
    const calls = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ table, method, url, body, headers: new Headers(init.headers) });
        if (table === "room" && method === "GET") return response(parentMissing ? null : { room_id: 3, hotel_id: 4 });
        if (table === "restaurant" && method === "GET") return response(parentMissing ? null : { restaurant_id: 7, hotel_id: 4 });
        if (table === "amenity" && method === "GET") {
            if (url.searchParams.get("amenity_id")?.startsWith("in.")) return response([{ amenity_id: 9, name: amenity.name, description: amenity.description }]);
            return response(amenityMissing ? null : { ...amenity, hotel_id: crossHotel ? 5 : 4 });
        }
        if ((table === "room_amenity" || table === "restaurant_amenity") && method === "GET") {
            if (url.searchParams.has("amenity_id")) return response(existingLink ? { amenity_id: 9 } : null);
            return response([{ amenity_id: 9 }]);
        }
        if ((table === "room_amenity" || table === "restaurant_amenity") && method === "POST") {
            if (uniqueViolation) return response({ code: "23505", message: "duplicate" }, 409);
            return response({ ...body }, 201);
        }
        if ((table === "room_amenity" || table === "restaurant_amenity") && method === "DELETE") return response(linkMissing ? null : { amenity_id: 9 });
        if (table === "staff_restaurant_assignment" && method === "GET") return response(assignment ? { restaurant_id: 7 } : null);
        throw new Error(`Unexpected ${method} ${url}`);
    };
    return { fetch, calls };
};

const withDb = async (db, callback) => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = db.fetch;
    try { await callback(); } finally { globalThis.fetch = oldFetch; }
};

test("room amenity GET returns only amenity_id, name, description for any logged-in role", async () => {
    const db = fakeDb();
    await withDb(db, async () => {
        const result = await invoke(controller.getRoomAmenitiesController, request({ roomId: "3" }, "Customer"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [{ amenity_id: 9, name: "Pool", description: "Outdoor" }]);
    });
});

test("nested amenity GET routes precede /:id and have no additional role guard", () => {
    for (const [router, nestedPath, getHandler] of [
        [roomRouter.default, "/:roomId/amenities", controller.getRoomAmenitiesController],
        [restaurantRouter.default, "/:restaurantId/amenities", controller.getRestaurantAmenitiesController],
    ]) {
        const nestedIndex = router.stack.findIndex((layer) => layer.route?.path === nestedPath && layer.route.methods.get);
        const byIdIndex = router.stack.findIndex((layer) => layer.route?.path === "/:id" && layer.route.methods.get);
        assert.ok(nestedIndex >= 0 && nestedIndex < byIdIndex);
        assert.equal(router.stack[nestedIndex].route.stack.length, 1);
        assert.equal(router.stack[nestedIndex].route.stack[0].handle, getHandler);
    }
});

test("restaurant amenity GET returns selected amenity fields for any logged-in role", async () => {
    const db = fakeDb();
    await withDb(db, async () => {
        const result = await invoke(controller.getRestaurantAmenitiesController, request({ restaurantId: "7" }, "Customer"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [{ amenity_id: 9, name: "Pool", description: "Outdoor" }]);
    });
});

for (const [handler, params, message] of [
    [controller.getRoomAmenitiesController, { roomId: "abc" }, "Invalid room id"],
    [controller.getRestaurantAmenitiesController, { restaurantId: "1.5" }, "Invalid restaurant id"],
    [controller.addRoomAmenityController, { roomId: "0", amenity_id: 9 }, "Invalid room id"],
    [controller.addRoomAmenityController, { roomId: "3", amenity_id: "-1" }, "Invalid amenity id"],
    [controller.addRestaurantAmenityController, { restaurantId: "-1", amenity_id: 9 }, "Invalid restaurant id"],
    [controller.addRestaurantAmenityController, { restaurantId: "7", amenity_id: "abc" }, "Invalid amenity id"],
    [controller.deleteRoomAmenityController, { roomId: "1.5", amenityId: "9" }, "Invalid room id"],
    [controller.deleteRoomAmenityController, { roomId: "3", amenityId: "0" }, "Invalid amenity id"],
    [controller.deleteRestaurantAmenityController, { restaurantId: "abc", amenityId: "9" }, "Invalid restaurant id"],
    [controller.deleteRestaurantAmenityController, { restaurantId: "7", amenityId: "1.5" }, "Invalid amenity id"],
]) {
    test(`${message} is returned before database access`, async () => {
        let queried = false;
        const oldFetch = globalThis.fetch;
        globalThis.fetch = async () => { queried = true; throw new Error("unexpected query"); };
        try {
            const body = Object.hasOwn(params, "amenity_id") ? { amenity_id: params.amenity_id } : {};
            const result = await invoke(handler, request(params, "Admin", body));
            assert.equal(result.statusCode, 400);
            assert.deepEqual(result.body, { message });
            assert.equal(queried, false);
        } finally { globalThis.fetch = oldFetch; }
    });
}

test("missing parent and amenity rows return their 404 messages", async () => {
    let db = fakeDb({ parentMissing: true });
    await withDb(db, async () => {
        const room = await invoke(controller.addRoomAmenityController, request({ roomId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(room.statusCode, 404);
        assert.deepEqual(room.body, { message: "Room not found" });
    });
    db = fakeDb({ parentMissing: true });
    await withDb(db, async () => {
        const restaurant = await invoke(controller.addRestaurantAmenityController, request({ restaurantId: "7" }, "Admin", { amenity_id: 9 }));
        assert.equal(restaurant.statusCode, 404);
        assert.deepEqual(restaurant.body, { message: "Restaurant not found" });
    });
    db = fakeDb({ amenityMissing: true });
    await withDb(db, async () => {
        const missing = await invoke(controller.addRoomAmenityController, request({ roomId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(missing.statusCode, 404);
        assert.deepEqual(missing.body, { message: "Amenity not found" });
    });
});

test("link creation rejects different hotels before insert and duplicate 23505 with 409", async () => {
    for (const [handler, params, table] of [
        [controller.addRoomAmenityController, { roomId: "3" }, "room_amenity"],
        [controller.addRestaurantAmenityController, { restaurantId: "7" }, "restaurant_amenity"],
    ]) {
        let db = fakeDb({ crossHotel: true });
        await withDb(db, async () => {
            const result = await invoke(handler, request(params, "Admin", { amenity_id: 9 }));
            assert.equal(result.statusCode, 400);
            assert.deepEqual(result.body, { message: "Amenity belongs to a different hotel" });
            assert.equal(db.calls.some((call) => call.table === table && call.method === "POST"), false);
        });
        db = fakeDb({ uniqueViolation: true });
        await withDb(db, async () => {
            const result = await invoke(handler, request(params, "Admin", { amenity_id: 9 }));
            assert.equal(result.statusCode, 409);
            assert.deepEqual(result.body, { message: "Amenity already linked" });
        });
    }
});

test("duplicate links are detected before insert; DELETE with no link returns 404", async () => {
    const duplicate = fakeDb({ existingLink: true });
    await withDb(duplicate, async () => {
        const result = await invoke(controller.addRoomAmenityController, request({ roomId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(result.statusCode, 409);
        assert.deepEqual(result.body, { message: "Amenity already linked" });
        assert.equal(duplicate.calls.some((call) => call.method === "POST"), false);
    });
    const missing = fakeDb({ linkMissing: true });
    await withDb(missing, async () => {
        const result = await invoke(controller.deleteRoomAmenityController, request({ roomId: "3", amenityId: "9" }));
        assert.equal(result.statusCode, 404);
        assert.deepEqual(result.body, { message: "Amenity link not found" });
    });
});

test("unassigned Staff cannot write restaurant links; Customer is forbidden from writes", async () => {
    const db = fakeDb({ assignment: false });
    await withDb(db, async () => {
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        await accessMiddleware.restaurantAmenityAccess(request({ restaurantId: "7" }, "Staff"), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Not assigned to this restaurant" });
        assert.equal(nextCalled, false);
    });

    const adminDb = fakeDb();
    await withDb(adminDb, async () => {
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        await accessMiddleware.restaurantAmenityAccess(request({ restaurantId: "7" }, "Admin"), res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(adminDb.calls.length, 0);
    });

    const roomPost = roomRouter.default.stack.find((layer) => layer.route?.path === "/:roomId/amenities" && layer.route.methods.post)?.route;
    const restaurantPost = restaurantRouter.default.stack.find((layer) => layer.route?.path === "/:restaurantId/amenities" && layer.route.methods.post)?.route;
    for (const route of [roomPost, restaurantPost]) {
        assert.ok(route);
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        route.stack[0].handle(request({}, "Customer"), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Insufficient permissions" });
        assert.equal(nextCalled, false);
    }
});

test("unexpected link query errors return a safe message-only 500", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => response({ message: "sensitive database error" }, 500);
    try {
        const result = await invoke(controller.getRoomAmenitiesController, request({ roomId: "3" }));
        assert.equal(result.statusCode, 500);
        assert.deepEqual(result.body, { message: "Failed to retrieve room amenities" });
    } finally { globalThis.fetch = oldFetch; }
});

test("missing CSRF returns 403 for amenity creation and a room amenity link write", async () => {
    const resolved = {
        session: { sessionId: "session-id", userId: ADMIN_ID, purpose: "app", scope: "app", lastActivityAt: new Date() },
        credentials: { accessToken: "session-token" },
        csrfTokenHash: Buffer.alloc(32, 7),
    };
    const authenticate = authMiddleware.createAuthenticationMiddleware({}, {
        resolveSession: async () => resolved,
        revokeCurrentSession: async () => true,
        recordMeaningfulActivity: async () => true,
        getRequestSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: ADMIN_ID } }, error: null }) } }),
        getProfile: async () => ({ profile: { user_id: ADMIN_ID, role_id: 1, role: { role_name: "Admin" } }, error: null }),
        runWithRequest: (_req, callback) => callback(),
        now: () => new Date(),
    });
    assert.equal(amenitiesRouter.default.stack[0].handle, authMiddleware.authenticate);
    assert.equal(roomRouter.default.stack[0].handle, authMiddleware.authenticate);
    for (const path of ["/api/amenities", "/api/rooms/3/amenities"]) {
        const req = {
            method: "POST", originalUrl: path, path, baseUrl: "", headers: { cookie: `${authConfig.SESSION_COOKIE_NAME}=opaque` },
            get: () => undefined,
        };
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        await authenticate(req, res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Invalid or missing CSRF token" });
        assert.equal(nextCalled, false);
    }
});
