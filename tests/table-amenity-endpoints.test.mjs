import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [controller, routerModule, authMiddleware, authConfig] = await Promise.all([
    import("../dist/controllers/amenity-link.controller.js"),
    import("../dist/routes/table.routes.js"),
    import("../dist/middleware/auth.middleware.js"),
    import("../dist/config/session-cookie.js"),
]);

const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const amenity = { amenity_id: 9, hotel_id: 4, name: "Pool", description: "Outdoor" };
const response = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});
const request = (params = {}, roleName = "Admin", body = {}) => ({
    method: "GET", params, query: {}, body, headers: {},
    auth: { roleName, user: { id: ADMIN_ID }, accessToken: "request-token" },
});
const invoke = async (handler, req) => {
    const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send() { return this; } };
    const previousError = console.error;
    console.error = () => undefined;
    try { await handler(req, res); } finally { console.error = previousError; }
    return res;
};

const fakeDb = ({ tableMissing = false, amenityMissing = false, crossHotel = false, existingLink = false, linkMissing = false, assignment = true, uniqueViolation = false } = {}) => {
    const calls = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ table, method, url, body, headers: new Headers(init.headers) });
        if (table === "restaurant_table" && method === "GET") {
            return response(tableMissing ? null : { table_id: 3, restaurant_id: 7, restaurant: { hotel_id: 4 } });
        }
        if (table === "staff_restaurant_assignment" && method === "GET") {
            return response(assignment ? { restaurant_id: 7 } : null);
        }
        if (table === "amenity" && method === "GET") {
            if (url.searchParams.get("amenity_id")?.startsWith("in.")) return response([{ amenity_id: 9, name: amenity.name, description: amenity.description }]);
            return response(amenityMissing ? null : { ...amenity, hotel_id: crossHotel ? 5 : 4 });
        }
        if (table === "table_amenity" && method === "GET") {
            if (url.searchParams.has("amenity_id")) return response(existingLink ? { amenity_id: 9 } : null);
            return response([{ amenity_id: 9 }]);
        }
        if (table === "table_amenity" && method === "POST") {
            if (uniqueViolation) return response({ code: "23505", message: "duplicate key" }, 409);
            return response(body, 201);
        }
        if (table === "table_amenity" && method === "DELETE") return response(linkMissing ? null : { amenity_id: 9 });
        throw new Error(`Unexpected ${method} ${url}`);
    };
    return { fetch, calls };
};

const withDb = async (db, callback) => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = db.fetch;
    try { await callback(); } finally { globalThis.fetch = previousFetch; }
};

test("Staff reads table amenities only after the assigned restaurant check", async () => {
    const db = fakeDb({ assignment: true });
    await withDb(db, async () => {
        const result = await invoke(controller.getTableAmenitiesController, request({ tableId: "3" }, "Staff"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [{ amenity_id: 9, name: "Pool", description: "Outdoor" }]);
        assert.ok(db.calls.some((call) => call.table === "staff_restaurant_assignment"));
        assert.ok(db.calls.some((call) => call.table === "table_amenity" && call.method === "GET"));
    });
});

test("unassigned Staff cannot read table amenities", async () => {
    const db = fakeDb({ assignment: false });
    await withDb(db, async () => {
        const result = await invoke(controller.getTableAmenitiesController, request({ tableId: "3" }, "Staff"));
        assert.equal(result.statusCode, 403);
        assert.deepEqual(result.body, { message: "Not assigned to this restaurant" });
        assert.equal(db.calls.some((call) => call.table === "table_amenity"), false);
    });
});

test("Admin reads table amenities without an assignment lookup", async () => {
    const db = fakeDb();
    await withDb(db, async () => {
        const result = await invoke(controller.getTableAmenitiesController, request({ tableId: "3" }, "Admin"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [{ amenity_id: 9, name: "Pool", description: "Outdoor" }]);
        assert.equal(db.calls.some((call) => call.table === "staff_restaurant_assignment"), false);
    });
});

test("Admin links a same-hotel amenity to a table", async () => {
    const db = fakeDb();
    await withDb(db, async () => {
        const result = await invoke(controller.addTableAmenityController, request({ tableId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(result.statusCode, 201);
        assert.deepEqual(result.body, { table_id: 3, amenity_id: 9 });
        assert.deepEqual(db.calls.find((call) => call.table === "table_amenity" && call.method === "POST")?.body, { table_id: 3, amenity_id: 9 });
    });
});

test("Admin unlinks a table amenity", async () => {
    const db = fakeDb();
    await withDb(db, async () => {
        const result = await invoke(controller.deleteTableAmenityController, request({ tableId: "3", amenityId: "9" }));
        assert.equal(result.statusCode, 204);
        assert.ok(db.calls.some((call) => call.table === "table_amenity" && call.method === "DELETE"));
    });
});

test("table amenity endpoints return 404 for a missing table or amenity", async () => {
    let db = fakeDb({ tableMissing: true });
    await withDb(db, async () => {
        const result = await invoke(controller.addTableAmenityController, request({ tableId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(result.statusCode, 404);
        assert.deepEqual(result.body, { message: "Table not found" });
    });
    db = fakeDb({ amenityMissing: true });
    await withDb(db, async () => {
        const result = await invoke(controller.addTableAmenityController, request({ tableId: "3" }, "Admin", { amenity_id: 9 }));
        assert.equal(result.statusCode, 404);
        assert.deepEqual(result.body, { message: "Amenity not found" });
    });
});

test("table amenity link and unlink reject cross-hotel amenities", async () => {
    for (const [handler, params, body] of [
        [controller.addTableAmenityController, { tableId: "3" }, { amenity_id: 9 }],
        [controller.deleteTableAmenityController, { tableId: "3", amenityId: "9" }, {}],
    ]) {
        const db = fakeDb({ crossHotel: true });
        await withDb(db, async () => {
            const result = await invoke(handler, request(params, "Admin", body));
            assert.equal(result.statusCode, 400);
            assert.deepEqual(result.body, { message: "Amenity belongs to a different hotel" });
            assert.equal(db.calls.some((call) => call.table === "table_amenity" && ["POST", "DELETE"].includes(call.method)), false);
        });
    }
});

test("duplicate table amenity links return 409", async () => {
    for (const db of [fakeDb({ existingLink: true }), fakeDb({ uniqueViolation: true })]) {
        await withDb(db, async () => {
            const result = await invoke(controller.addTableAmenityController, request({ tableId: "3" }, "Admin", { amenity_id: 9 }));
            assert.equal(result.statusCode, 409);
            assert.deepEqual(result.body, { message: "Amenity already linked" });
        });
    }
});

test("table amenity endpoints reject invalid table and amenity ids before database access", async () => {
    for (const [handler, params, body, message] of [
        [controller.getTableAmenitiesController, { tableId: "abc" }, {}, "Invalid table id"],
        [controller.addTableAmenityController, { tableId: "0" }, { amenity_id: 9 }, "Invalid table id"],
        [controller.addTableAmenityController, { tableId: "3" }, { amenity_id: "abc" }, "Invalid amenity id"],
        [controller.deleteTableAmenityController, { tableId: "1.5", amenityId: "9" }, {}, "Invalid table id"],
        [controller.deleteTableAmenityController, { tableId: "3", amenityId: "-1" }, {}, "Invalid amenity id"],
    ]) {
        let queried = false;
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async () => { queried = true; throw new Error("unexpected query"); };
        try {
            const result = await invoke(handler, request(params, "Admin", body));
            assert.equal(result.statusCode, 400);
            assert.deepEqual(result.body, { message });
            assert.equal(queried, false);
        } finally { globalThis.fetch = previousFetch; }
    }
});

test("Customer receives 403 on table amenity read, link, and unlink routes", async () => {
    const routes = routeSet();
    for (const route of [routes.get, routes.post, routes.delete]) {
        const guardIndex = route.methods.get ? 1 : 1;
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        route.stack[guardIndex].handle(request({}, "Customer"), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Insufficient permissions" });
        assert.equal(nextCalled, false);
    }
});

test("anonymous GET receives 403 after optional authentication", async () => {
    const route = routeSet().get;
    const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await route.stack[0].handle({ headers: {}, method: "GET", originalUrl: "/api/tables/3/amenities", baseUrl: "", path: "/3/amenities" }, res, () => {
        route.stack[1].handle({}, res, () => assert.fail("anonymous request reached controller"));
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { message: "Insufficient permissions" });
});

test("table amenity writes retain authenticate and Admin-only CSRF guards", () => {
    const routes = routeSet();
    assert.equal(routes.post.stack[0].handle, authMiddleware.authenticate);
    assert.equal(routes.delete.stack[0].handle, authMiddleware.authenticate);
    for (const route of [routes.post, routes.delete]) {
        let nextCalled = false;
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        route.stack[1].handle(request({}, "Staff"), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.equal(nextCalled, false);
    }
});

test("missing CSRF blocks the table amenity write routes", async () => {
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
    for (const path of ["/api/tables/3/amenities", "/api/tables/3/amenities/9"]) {
        const req = { method: path.endsWith("/9") ? "DELETE" : "POST", originalUrl: path, path, baseUrl: "", headers: { cookie: `${authConfig.SESSION_COOKIE_NAME}=opaque` }, get: () => undefined };
        const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        let nextCalled = false;
        await authenticate(req, res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Invalid or missing CSRF token" });
        assert.equal(nextCalled, false);
    }
});

function routeSet() {
    const router = routerModule.default;
    return {
        get: router.stack.find((layer) => layer.route?.path === "/:tableId/amenities" && layer.route.methods.get)?.route,
        post: router.stack.find((layer) => layer.route?.path === "/:tableId/amenities" && layer.route.methods.post)?.route,
        delete: router.stack.find((layer) => layer.route?.path === "/:tableId/amenities/:amenityId" && layer.route.methods.delete)?.route,
    };
}
