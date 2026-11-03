import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: amenitiesRouter }, controller, authMiddleware] = await Promise.all([
    import("../dist/routes/amenity.routes.js"),
    import("../dist/controllers/amenity.controller.js"),
    import("../dist/middleware/auth.middleware.js"),
]);

const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const hotelRow = { hotel_id: 8 };
const amenityRow = { amenity_id: 12, hotel_id: 8, name: "Pool", description: "Outdoor pool" };

const response = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const request = (body = {}, params = {}, query = {}, roleName = "Admin") => ({
    body, params, query, headers: {},
    auth: { roleName, user: { id: ADMIN_ID }, accessToken: "request-token" },
});

const invoke = async (handler, req) => {
    const res = {
        statusCode: 200, body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send() { return this; },
    };
    const previous = console.error;
    console.error = () => undefined;
    try { await handler(req, res); } finally { console.error = previous; }
    return res;
};

const dbFetch = ({ hotels = [hotelRow], amenities = [], existing = null, missing = false, duplicateConstraint = false } = {}) => {
    const calls = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ table, method, url, body, headers: new Headers(init.headers) });
        if (table === "hotel" && method === "GET") return response(hotels[0] ?? null);
        if (table === "amenity" && method === "GET") {
            if (url.searchParams.has("name") && existing) return response(existing);
            if (url.searchParams.has("amenity_id") && url.searchParams.get("select")?.includes("hotel_id")) return response(missing ? null : amenityRow);
            if (url.searchParams.has("amenity_id") && missing) return response(null);
            return response(amenities);
        }
        if (table === "amenity" && method === "POST") {
            if (duplicateConstraint) return response({ code: "23505", message: "duplicate key" }, 409);
            return response({ ...body, amenity_id: 12 });
        }
        if (table === "amenity" && method === "PATCH") return response(missing ? null : { ...amenityRow, ...body });
        if (table === "amenity" && method === "DELETE") return response(missing ? null : amenityRow);
        throw new Error(`Unexpected ${method} ${url}`);
    };
    return { fetch, calls };
};

test("GET amenities supports optional positive hotel_id filtering with request-scoped auth", async () => {
    const oldFetch = globalThis.fetch;
    const db = dbFetch({ amenities: [amenityRow] });
    globalThis.fetch = db.fetch;
    try {
        const result = await invoke(controller.getAmenitiesController, request({}, {}, { hotel_id: "8" }, "Customer"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, [amenityRow]);
        assert.equal(db.calls[0].url.searchParams.get("hotel_id"), "eq.8");
        assert.equal(db.calls[0].headers.get("authorization"), "Bearer request-token");
    } finally { globalThis.fetch = oldFetch; }
});

test("unexpected database errors return a safe message-only 500", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => response({ message: "sensitive database detail" }, 500);
    try {
        const result = await invoke(controller.getAmenitiesController, request());
        assert.equal(result.statusCode, 500);
        assert.deepEqual(result.body, { message: "Failed to retrieve amenities" });
    } finally { globalThis.fetch = oldFetch; }
});

for (const hotel_id of ["0", "-1", "abc", "", "1.5"]) {
    test(`GET amenities rejects invalid hotel_id ${JSON.stringify(hotel_id)}`, async () => {
        const oldFetch = globalThis.fetch;
        let queried = false;
        globalThis.fetch = async () => { queried = true; throw new Error("unexpected request"); };
        try {
            const result = await invoke(controller.getAmenitiesController, request({}, {}, { hotel_id }));
            assert.equal(result.statusCode, 400);
            assert.deepEqual(result.body, { message: "Invalid hotel id" });
            assert.equal(queried, false);
        } finally { globalThis.fetch = oldFetch; }
    });
}

test("POST trims name, accepts optional description, and returns 201", async () => {
    const oldFetch = globalThis.fetch;
    const db = dbFetch();
    globalThis.fetch = db.fetch;
    try {
        const result = await invoke(controller.createAmenityController, request({ hotel_id: 8, name: " Pool ", description: "Outdoor pool" }));
        assert.equal(result.statusCode, 201);
        assert.equal(result.body.name, "Pool");
        assert.equal(db.calls.find((call) => call.method === "POST")?.body.name, "Pool");
    } finally { globalThis.fetch = oldFetch; }
});

for (const body of [
    { hotel_id: 8, name: "   " },
    { hotel_id: 8, name: "x".repeat(101) },
    { hotel_id: 8, name: "Pool", description: "x".repeat(1001) },
    { hotel_id: 8, name: 12 },
]) {
    test(`POST rejects invalid amenity fields`, async () => {
        const oldFetch = globalThis.fetch;
        let queried = false;
        globalThis.fetch = async () => { queried = true; throw new Error("unexpected request"); };
        try {
            const result = await invoke(controller.createAmenityController, request(body));
            assert.equal(result.statusCode, 400);
            assert.equal(result.body.message, "Invalid amenity fields");
            assert.equal(queried, false);
        } finally { globalThis.fetch = oldFetch; }
    });
}

test("POST returns 400 when hotel is missing and 409 for duplicate name", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = dbFetch({ hotels: [] }).fetch;
    try {
        const missing = await invoke(controller.createAmenityController, request({ hotel_id: 8, name: "Pool" }));
        assert.equal(missing.statusCode, 400);
        assert.deepEqual(missing.body, { message: "Hotel not found" });
    } finally { globalThis.fetch = oldFetch; }

    const db = dbFetch({ existing: amenityRow });
    globalThis.fetch = db.fetch;
    try {
        const duplicate = await invoke(controller.createAmenityController, request({ hotel_id: 8, name: "Pool" }));
        assert.equal(duplicate.statusCode, 409);
        assert.deepEqual(duplicate.body, { message: "Amenity already exists" });
    } finally { globalThis.fetch = oldFetch; }
});

test("PUT rejects invalid id and an empty update", async () => {
    const invalid = await invoke(controller.updateAmenityController, request({ name: "Pool" }, { id: "nope" }));
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.body, { message: "Invalid amenity id" });

    const empty = await invoke(controller.updateAmenityController, request({ nonsense: true }, { id: "12" }));
    assert.equal(empty.statusCode, 400);
    assert.deepEqual(empty.body, { message: "No fields to update" });
});

test("PUT trims name, updates description, detects duplicates and missing rows", async () => {
    const oldFetch = globalThis.fetch;
    let db = dbFetch();
    globalThis.fetch = db.fetch;
    try {
        const updated = await invoke(controller.updateAmenityController, request({ name: " Gym ", description: "Fitness room" }, { id: "12" }));
        assert.equal(updated.statusCode, 200);
        assert.deepEqual(db.calls.find((call) => call.method === "PATCH")?.body, { name: "Gym", description: "Fitness room" });
    } finally { globalThis.fetch = oldFetch; }

    db = dbFetch({ existing: { ...amenityRow, amenity_id: 13, name: "Gym" } });
    globalThis.fetch = db.fetch;
    try {
        const duplicate = await invoke(controller.updateAmenityController, request({ name: "Gym" }, { id: "12" }));
        assert.equal(duplicate.statusCode, 409);
        assert.deepEqual(duplicate.body, { message: "Amenity already exists" });
    } finally { globalThis.fetch = oldFetch; }

    db = dbFetch({ missing: true });
    globalThis.fetch = db.fetch;
    try {
        const missing = await invoke(controller.updateAmenityController, request({ description: "New" }, { id: "12" }));
        assert.equal(missing.statusCode, 404);
        assert.deepEqual(missing.body, { message: "Amenity not found" });
    } finally { globalThis.fetch = oldFetch; }
});

test("DELETE validates id and returns 404 when amenity is missing", async () => {
    const invalid = await invoke(controller.deleteAmenityController, request({}, { id: "x" }));
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.body, { message: "Invalid amenity id" });

    const oldFetch = globalThis.fetch;
    globalThis.fetch = dbFetch({ missing: true }).fetch;
    try {
        const missing = await invoke(controller.deleteAmenityController, request({}, { id: "12" }));
        assert.equal(missing.statusCode, 404);
        assert.deepEqual(missing.body, { message: "Amenity not found" });
    } finally { globalThis.fetch = oldFetch; }
});

test("amenity routes authenticate all users and restrict writes to Admin", () => {
    const getRoute = amenitiesRouter.stack.find((layer) => layer.route?.methods.get)?.route;
    assert.equal(getRoute.stack[0].handle, authMiddleware.optionalAuthenticate);
    for (const method of ["post", "put", "delete"]) {
        const route = amenitiesRouter.stack.find((layer) => layer.route?.methods[method])?.route;
        assert.ok(route);
        assert.equal(route.stack[0].handle, authMiddleware.authenticate);
        const guard = route.stack[1].handle;
        for (const roleName of ["Staff", "Customer"]) {
            const res = {
                statusCode: 200, body: undefined,
                status(code) { this.statusCode = code; return this; },
                json(body) { this.body = body; return this; },
            };
            let nextCalled = false;
            guard(request({}, {}, {}, roleName), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, { message: "Insufficient permissions" });
            assert.equal(nextCalled, false);
        }
        const adminResponse = {
            statusCode: 200, body: undefined,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        let adminNextCalled = false;
        route.stack[1].handle(request({}, {}, {}, "Admin"), adminResponse, () => { adminNextCalled = true; });
        assert.equal(adminNextCalled, true);
    }
});
