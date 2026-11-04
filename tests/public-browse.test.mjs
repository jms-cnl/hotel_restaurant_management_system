import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-anon-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-credential";
process.env.HRMS_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION = "1";

const [hotelRouter, roomRouter, restaurantRouter, tableRouter, amenityRouter, authMiddleware, authConfig] = await Promise.all([
    import("../dist/routes/hotel.routes.js"),
    import("../dist/routes/room.routes.js"),
    import("../dist/routes/restaurant.routes.js"),
    import("../dist/routes/table.routes.js"),
    import("../dist/routes/amenity.routes.js"),
    import("../dist/middleware/auth.middleware.js"),
    import("../dist/config/session-cookie.js"),
]);

const hotel = { hotel_id: 8, name: "Harbor Hotel" };
const room = { room_id: 4, hotel_id: 8, hotel };
const restaurant = { restaurant_id: 3, hotel_id: 8, name: "Cafe" };
const table = { table_id: 5, restaurant_id: 3, restaurant };

const response = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const makeRequest = (params = {}, query = {}, headers = {}) => ({
    method: "GET", params, query, body: {}, headers, path: "/", originalUrl: "/", baseUrl: "",
});

const makeResponse = () => ({
    statusCode: 200,
    body: undefined,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    clearCookie(...args) { this.cookies.push(args); return this; },
    send() { return this; },
});

const dbFetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const tableName = url.pathname.split("/").at(-1);
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET") throw new Error(`Unexpected ${method} ${url}`);
    if (tableName === "hotel") return response(url.searchParams.has("hotel_id") ? hotel : [hotel]);
    if (tableName === "room") {
        if (url.searchParams.get("select") === "room_id, hotel_id") return response({ room_id: 4, hotel_id: 8 });
        return response(url.searchParams.has("room_id") ? room : [room]);
    }
    if (tableName === "restaurant") return response(url.searchParams.has("restaurant_id") ? restaurant : [restaurant]);
    if (tableName === "restaurant_table") return response(url.searchParams.has("table_id") ? table : [table]);
    if (tableName === "room_amenity" || tableName === "restaurant_amenity") return response([]);
    if (tableName === "amenity") return response([]);
    throw new Error(`Unexpected GET ${url}`);
};

const routeFor = (router, method, path) => router.default.stack
    .find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;

const dispatchOptionalGet = async (router, path, params = {}, query = {}, headers = {}, auth = undefined) => {
    const route = routeFor(router, "get", path);
    assert.ok(route, `Missing GET ${path}`);
    const req = makeRequest(params, query, headers);
    if (auth) req.auth = auth;
    const res = makeResponse();
    const [optionalAuth, controller] = route.stack.map((layer) => layer.handle);
    assert.equal(optionalAuth, authMiddleware.optionalAuthenticate);
    assert.equal(typeof controller, "function");

    let controllerResult;
    await optionalAuth(req, res, (error) => {
        if (error) throw error;
        controllerResult = controller(req, res);
    });
    if (controllerResult) await controllerResult;
    return { req, res };
};

test("anonymous GETs return 200 on every public browse route", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = dbFetch;
    const cases = [
        [hotelRouter, "/", {}], [hotelRouter, "/:id", { id: "8" }],
        [roomRouter, "/", {}], [roomRouter, "/:roomId/amenities", { roomId: "4" }], [roomRouter, "/:id", { id: "4" }],
        [restaurantRouter, "/", {}], [restaurantRouter, "/:restaurantId/amenities", { restaurantId: "3" }], [restaurantRouter, "/:id", { id: "3" }],
        [tableRouter, "/", {}], [tableRouter, "/:id", { id: "5" }],
        [amenityRouter, "/", {}],
    ];
    try {
        for (const [router, path, params] of cases) {
            const { req, res } = await dispatchOptionalGet(router, path, params);
            assert.equal(req.auth, undefined);
            assert.equal(res.statusCode, 200, `${path} should be public`);
        }
    } finally { globalThis.fetch = previousFetch; }
});

test("anonymous writes on all five routers stop at authenticate with 401", async () => {
    const routers = [hotelRouter, roomRouter, restaurantRouter, tableRouter, amenityRouter];
    for (const router of routers) {
        const writeRoutes = router.default.stack
            .filter((layer) => layer.route && (layer.route.methods.post || layer.route.methods.put || layer.route.methods.delete));
        assert.ok(writeRoutes.length > 0);
        for (const layer of writeRoutes) {
            const req = { method: layer.route.methods.post ? "POST" : layer.route.methods.put ? "PUT" : "DELETE", headers: {}, params: {}, body: {} };
            const res = makeResponse();
            assert.equal(layer.route.stack[0].handle, authMiddleware.authenticate);
            await layer.route.stack[0].handle(req, res, () => assert.fail("anonymous write reached its handler"));
            assert.equal(res.statusCode, 401);
            assert.deepEqual(res.body, { message: "Authentication required" });
        }
    }
});

test("credentialed GET still authenticates and returns data", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/auth/v1/user")) return response({ id: "00000000-0000-4000-8000-000000000003" });
        if (url.pathname.endsWith("/rest/v1/user")) return response({
            user_id: "00000000-0000-4000-8000-000000000003",
            role_id: 3,
            role: { role_name: "Customer" },
        });
        if (url.pathname.endsWith("/rest/v1/hotel")) {
            assert.equal(new Headers(init.headers).get("authorization"), "Bearer customer-token");
            return response([hotel]);
        }
        throw new Error(`Unexpected request ${url}`);
    };
    try {
        const route = routeFor(hotelRouter, "get", "/");
        const req = makeRequest({}, {}, { authorization: "Bearer customer-token" });
        const res = makeResponse();
        let controllerResult;
        await route.stack[0].handle(req, res, (error) => {
            if (error) throw error;
            controllerResult = route.stack[1].handle(req, res);
        });
        if (controllerResult) await controllerResult;
        assert.equal(req.auth.roleName, "Customer");
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, [hotel]);
    } finally { globalThis.fetch = previousFetch; }
});

test("optional auth still rejects invalid bearer tokens but ignores malformed cookies", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => response({ message: "Invalid token", code: "invalid_token" }, 401);
    try {
        const invalidBearer = async (middleware) => {
            const req = makeRequest({}, {}, { authorization: "Bearer invalid-token" });
            const res = makeResponse();
            await middleware(req, res, () => assert.fail("invalid bearer was accepted"));
            return res;
        };
        const expected = await invalidBearer(authMiddleware.authenticate);
        const actual = await invalidBearer(authMiddleware.optionalAuthenticate);
        assert.equal(expected.statusCode, 401);
        assert.equal(actual.statusCode, expected.statusCode);
        assert.deepEqual(actual.body, expected.body);

        const authReq = makeRequest({}, {}, { cookie: `${authConfig.SESSION_COOKIE_NAME}=%E0%A4%A` });
        const authRes = makeResponse();
        await authMiddleware.authenticate(authReq, authRes, () => assert.fail("authenticate accepted malformed session cookie"));
        assert.equal(authRes.statusCode, 401);
        assert.deepEqual(authRes.body, { message: "Invalid or expired session" });
        assert.equal(authRes.cookies[0][0], authConfig.SESSION_COOKIE_NAME);

        const optionalReq = makeRequest({}, {}, { cookie: `${authConfig.SESSION_COOKIE_NAME}=%E0%A4%A` });
        const optionalRes = makeResponse();
        let continued = false;
        await authMiddleware.optionalAuthenticate(optionalReq, optionalRes, () => { continued = true; });
        assert.equal(continued, true);
        assert.equal(optionalReq.auth, undefined);
        assert.equal(optionalRes.cookies[0][0], authConfig.SESSION_COOKIE_NAME);
    } finally { globalThis.fetch = previousFetch; }
});

test("public GET treats a stale session cookie as anonymous and clears it", async () => {
    const { sessionService } = await import("../dist/services/session.service.js");
    const originalResolve = sessionService.resolveSession;
    const originalFetch = globalThis.fetch;
    sessionService.resolveSession = async () => null;
    globalThis.fetch = dbFetch;
    try {
        const { req, res } = await dispatchOptionalGet(hotelRouter, "/", {}, {}, { cookie: "hrm_session=stale-cookie" });
        assert.equal(req.auth, undefined);
        assert.equal(res.statusCode, 200);
        assert.equal(res.cookies[0][0], "hrm_session");
        assert.equal(res.cookies[0][1].httpOnly, true);
    } finally {
        sessionService.resolveSession = originalResolve;
        globalThis.fetch = originalFetch;
    }
});

test("public GET treats a valid recovery cookie as anonymous and keeps it", async () => {
    const { sessionService } = await import("../dist/services/session.service.js");
    const originalResolve = sessionService.resolveSession;
    const originalFetch = globalThis.fetch;
    sessionService.resolveSession = async (_secret, _now, options) => {
        assert.equal(options.allowRecovery, true);
        return {
            session: { sessionId: "recovery-session", userId: "customer-1", purpose: "recovery", scope: "password_reset" },
            credentials: { accessToken: "recovery-access-token", refreshToken: "server-only" },
            csrfTokenHash: Buffer.alloc(32, 1),
        };
    };
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") {
            assert.equal(new Headers(init.headers).get("authorization"), "Bearer recovery-access-token");
            return response({ id: "customer-1", email: "guest@example.test" });
        }
        if (url.pathname === "/rest/v1/user") assert.fail("recovery session should not be treated as an application user");
        if (url.pathname.startsWith("/rest/v1/")) {
            assert.notEqual(new Headers(init.headers).get("authorization"), "Bearer recovery-access-token");
            return dbFetch(input, init);
        }
        throw new Error(`Unexpected request ${url}`);
    };
    try {
        const { req, res } = await dispatchOptionalGet(
            hotelRouter,
            "/",
            {},
            {},
            { cookie: "hrm_session=recovery-cookie" },
            { accessToken: "preexisting-recovery-token", sessionPurpose: "recovery" },
        );
        assert.equal(req.auth, undefined);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.cookies, []);
    } finally {
        sessionService.resolveSession = originalResolve;
        globalThis.fetch = originalFetch;
    }
});

test("public GET treats an idle-expired cookie session as anonymous and clears it", async () => {
    const { sessionService } = await import("../dist/services/session.service.js");
    const originalResolve = sessionService.resolveSession;
    const originalRevoke = sessionService.revokeCurrentSession;
    const originalFetch = globalThis.fetch;
    sessionService.resolveSession = async () => ({
        session: { sessionId: "expired-session", userId: "customer-1", purpose: "app", scope: "application", lastActivityAt: "2020-01-01T00:00:00.000Z" },
        credentials: { accessToken: "expired-access-token", refreshToken: "server-only" },
        csrfTokenHash: Buffer.alloc(32, 1),
    });
    sessionService.revokeCurrentSession = async () => true;
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") return response({ id: "customer-1", email: "guest@example.test" });
        if (url.pathname === "/rest/v1/user") return response({ user_id: "customer-1", role_id: 3, role: { role_name: "Customer" } });
        return dbFetch(input, init);
    };
    try {
        const { res } = await dispatchOptionalGet(hotelRouter, "/", {}, {}, { cookie: "hrm_session=idle-expired" });
        assert.equal(res.statusCode, 200);
        assert.equal(res.cookies[0][0], "hrm_session");
    } finally {
        sessionService.resolveSession = originalResolve;
        sessionService.revokeCurrentSession = originalRevoke;
        globalThis.fetch = originalFetch;
    }
});

test("anon request client uses the configured public key without a user token", async () => {
    const { getRequestSupabase } = await import("../dist/config/supabase.js");
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get("apikey"), "sb_publishable_test-anon-key");
        assert.notEqual(headers.get("authorization"), "Bearer customer-token");
        return response([]);
    };
    try {
        await getRequestSupabase({ headers: {}, params: {}, query: {} }).from("hotel").select("hotel_id");
    } finally { globalThis.fetch = previousFetch; }
});
