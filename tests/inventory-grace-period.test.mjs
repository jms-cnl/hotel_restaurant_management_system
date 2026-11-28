import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [roomController, tableController, roomRouterModule, tableRouterModule, supabaseModule] = await Promise.all([
    import("../dist/controllers/room.controller.js"),
    import("../dist/controllers/table.controller.js"),
    import("../dist/routes/room.routes.js"),
    import("../dist/routes/table.routes.js"),
    import("../dist/config/supabase.js"),
]);

const response = () => ({
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { return this; },
});

const resourceCases = [
    {
        name: "room",
        table: "room",
        min: 0,
        max: 1440,
        create: roomController.createRoomController,
        update: roomController.updateRoomController,
        list: roomController.getRoomsController,
        router: roomRouterModule.default,
        createBody: { hotel_id: 1, room_number: "101", room_type: "Standard Room", capacity: 2, price_per_night: 100 },
        existing: { room_id: 17, hotel_id: 1, room_number: "101", room_type: "Standard Room", capacity: 2, price_per_night: 100, status: "Available", grace_period_minutes: 30 },
    },
    {
        name: "table",
        table: "restaurant_table",
        min: 0,
        max: 30,
        create: tableController.createTableController,
        update: tableController.updateTableController,
        list: tableController.getTablesController,
        router: tableRouterModule.default,
        createBody: { restaurant_id: 1, table_number: "T1", capacity: 4 },
        existing: { table_id: 23, restaurant_id: 1, table_number: "T1", capacity: 4, status: "Available", grace_period_minutes: 30 },
    },
];

const invokeController = async (handler, { body = {}, params = {}, database, method = "PATCH", roleName = "Admin" } = {}) => {
    const res = response();
    const requests = [];
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const requestMethod = (init.method ?? "GET").toUpperCase();
        const requestBody = init.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ url, method: requestMethod, body: requestBody });
        if (database) return database({ url, method: requestMethod, body: requestBody });
        const record = requestMethod === "POST"
            ? { ...body, ...(body.grace_period_minutes === undefined ? { grace_period_minutes: 30 } : {}), room_id: 17, table_id: 23, status: "Available" }
            : { ...resourceCases.find((item) => item.table === url.pathname.split("/").at(-1))?.existing, ...requestBody };
        return new Response(JSON.stringify(record), {
            status: requestMethod === "POST" ? 201 : 200,
            headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
        });
    };
    console.error = () => undefined;
    const req = {
        method,
        params,
        query: {},
        body,
        headers: { authorization: "Bearer request-token" },
        auth: { user: { id: "admin-1" }, accessToken: "request-token", roleName },
    };
    try {
        await new Promise((resolve, reject) => supabaseModule.runWithRequest(req, () => Promise.resolve(handler(req, res)).then(resolve, reject)));
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
    }
    return { response: res, requests };
};

for (const resource of resourceCases) {
    for (const operation of ["create", "update"]) {
        for (const value of [resource.min, resource.max]) {
            test(`${operation} ${resource.name} accepts grace period ${value}`, async () => {
                const body = operation === "create"
                    ? { ...resource.createBody, grace_period_minutes: value }
                    : { grace_period_minutes: value };
                const { response: result, requests } = await invokeController(resource[operation], {
                    body,
                    params: operation === "update" ? { id: String(resource.existing.room_id ?? resource.existing.table_id) } : {},
                });

                assert.equal(result.statusCode, operation === "create" ? 201 : 200);
                assert.equal(result.body.grace_period_minutes, value);
                assert.equal(requests[0].body.grace_period_minutes, value);
            });
        }
    }

    for (const operation of ["create", "update"]) {
        for (const value of [-1, resource.max + 1, 1.5, "abc"]) {
            test(`${operation} ${resource.name} rejects grace period ${String(value)}`, async () => {
                const body = operation === "create"
                    ? { ...resource.createBody, grace_period_minutes: value }
                    : { grace_period_minutes: value };
                const { response: result, requests } = await invokeController(resource[operation], {
                    body,
                    params: operation === "update" ? { id: String(resource.existing.room_id ?? resource.existing.table_id) } : {},
                });

                assert.equal(result.statusCode, 400);
                assert.match(result.body.message, new RegExp(`grace_period_minutes must be an integer between 0 and ${resource.max}`));
                assert.deepEqual(requests, []);
            });
        }
    }

    test(`${resource.name} create leaves omitted grace period to the database default`, async () => {
        const { response: result, requests } = await invokeController(resource.create, { body: resource.createBody });
        assert.equal(result.statusCode, 201);
        assert.equal(Object.hasOwn(requests[0].body, "grace_period_minutes"), false);
        assert.equal(result.body.grace_period_minutes, 30);
    });

    test(`${resource.name} update preserves the grace period when omitted`, async () => {
        const id = String(resource.existing.room_id ?? resource.existing.table_id);
        const { response: result, requests } = await invokeController(resource.update, {
            body: { status: "Maintenance" },
            params: { id },
        });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.grace_period_minutes, 30);
        assert.equal(Object.hasOwn(requests[0].body, "grace_period_minutes"), false);
    });

    test(`GET ${resource.table} includes grace period from the inventory row`, async () => {
        const row = { ...resource.existing, grace_period_minutes: 25 };
        const { response: result, requests } = await invokeController(resource.list, {
            method: "GET",
            database: async () => new Response(JSON.stringify([row]), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } }),
        });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body[0].grace_period_minutes, 25);
        assert.match(requests[0].url.searchParams.get("select"), /^\*,/);
    });

    test(`${resource.name} maps a trigger permission error to 403`, async () => {
        const { response: result } = await invokeController(resource.update, {
            body: { grace_period_minutes: 15 },
            params: { id: String(resource.existing.room_id ?? resource.existing.table_id) },
            database: async () => new Response(JSON.stringify({ code: "42501", message: "permission denied by trigger" }), { status: 403, headers: { "Content-Type": "application/json" } }),
        });
        assert.equal(result.statusCode, 403);
        assert.deepEqual(result.body, { message: "Insufficient permissions" });
    });
}

test("Staff and Customers remain forbidden from room and table create/update routes", () => {
    for (const resource of resourceCases) {
        for (const roleName of ["Staff", "Customer"]) {
            for (const [path, method] of [["/", "post"], ["/:id", "put"]]) {
                const route = resource.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;
                assert.ok(route, `${method.toUpperCase()} ${path} exists`);
                const guard = route.stack[1].handle;
                const res = response();
                let nextCalled = false;
                guard({ auth: { roleName } }, res, () => { nextCalled = true; });
                assert.equal(res.statusCode, 403, `${roleName} ${method.toUpperCase()} ${resource.name}`);
                assert.equal(nextCalled, false);
            }
        }
    }
});
