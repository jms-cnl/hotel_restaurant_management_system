import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [
    { default: restaurantRouter },
    { default: tableRouter },
    { default: mediaRouter },
    { default: reservationRouter },
    { default: combinedRouter },
    { default: staffAssignmentRouter },
    assignmentController,
    reservationController,
    { requireStaffAssignmentAdmin },
] = await Promise.all([
    import("../dist/routes/restaurant.routes.js"),
    import("../dist/routes/table.routes.js"),
    import("../dist/routes/media.routes.js"),
    import("../dist/routes/reservation.routes.js"),
    import("../dist/routes/combined-booking.routes.js"),
    import("../dist/routes/staff-assignment.routes.js"),
    import("../dist/controllers/staff-assignment.controller.js"),
    import("../dist/controllers/reservation.controller.js"),
    import("../dist/routes/staff-assignment.routes.js"),
]);
const { assertRestaurantAccess } = await import("../dist/middleware/restaurant-access.middleware.js");

const routeFor = (router, path, method) => router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
)?.route;

const restaurantGuardFor = (route) => route.stack.find((layer) => layer.handle.name === "restaurantAccessGuard")?.handle;

const response = () => ({
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send() { return this; },
});

const invoke = async (handler, req) => {
    const res = response();
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    return { ...res, nextCalled };
};

const request = (roleName = "Staff", params = {}, body = {}) => ({
    params,
    body,
    query: {},
    headers: {},
    auth: { roleName, user: { id: "00000000-0000-4000-8000-000000000001" }, accessToken: "verified-user-token" },
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const withAccessFetch = async (assignedIds, action, { tableRestaurantId = 2, mediaRestaurantId = 2 } = {}) => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        requests.push({ table, method, url });
        if (table === "staff_restaurant_assignment") {
            if (method === "GET" && url.searchParams.has("restaurant_id")) {
                const id = Number(url.searchParams.get("restaurant_id")?.replace("eq.", ""));
                return jsonResponse(assignedIds.includes(id) ? { restaurant_id: id } : null);
            }
            if (method === "GET") return jsonResponse(assignedIds.map((restaurant_id) => ({ restaurant_id })));
        }
        if (table === "restaurant_table" && method === "GET") return jsonResponse({ restaurant_id: tableRestaurantId });
        if (table === "reservation" && method === "GET") {
            if (url.searchParams.has("combined_booking_id")) return jsonResponse([{ reservation_type: "RESTAURANT", table_id: 20 }]);
            return jsonResponse({ reservation_type: "RESTAURANT", table_id: 20 });
        }
        if (table === "media" && method === "GET") {
            const select = url.searchParams.get("select");
            if (select === "hotel_id") return jsonResponse({ hotel_id: null });
            return jsonResponse({ restaurant_id: mediaRestaurantId });
        }
        return jsonResponse([]);
    };
    try {
        await action(requests);
    } finally {
        globalThis.fetch = originalFetch;
    }
};

const guardedRoutes = [
    ["restaurant PUT", restaurantRouter, "/:id", "put", { params: { id: "2" } }],
    ["table POST", tableRouter, "/", "post", { body: { restaurant_id: 2 } }],
    ["table PUT", tableRouter, "/:id", "put", { params: { id: "20" }, body: { table_number: "T1" } }],
    ["table DELETE", tableRouter, "/:id", "delete", { params: { id: "20" } }],
    ["restaurant media POST", mediaRouter, "/:entityType/:entityId", "post", { params: { entityType: "restaurant", entityId: "2" } }],
    ["restaurant media PUT", mediaRouter, "/:id/file", "put", { params: { id: "30" } }],
    ["restaurant media primary PATCH", mediaRouter, "/:id/primary", "patch", { params: { id: "30" } }],
    ["restaurant media order PATCH", mediaRouter, "/:id/order", "patch", { params: { id: "30" }, body: { display_order: 1 } }],
    ["restaurant media DELETE", mediaRouter, "/:id", "delete", { params: { id: "30" } }],
    ["restaurant reservation POST", reservationRouter, "/", "post", { body: { reservation_type: "RESTAURANT", table_id: 20 } }],
    ["restaurant reservation GET", reservationRouter, "/:id", "get", { params: { id: "40" } }],
    ["restaurant reservation history GET", reservationRouter, "/:id/history", "get", { params: { id: "40" } }],
    ["restaurant reservation PUT", reservationRouter, "/:id", "put", { params: { id: "40" }, body: { special_request: "Window" } }],
    ["restaurant reservation cancel DELETE", reservationRouter, "/:id", "delete", { params: { id: "40" } }],
    ["restaurant reservation status PATCH", reservationRouter, "/:id/status", "patch", { params: { id: "40" }, body: { status: "Confirmed" } }],
    ["combined booking PUT", combinedRouter, "/:id", "put", { params: { id: "50" }, body: {} }],
    ["combined booking cancel DELETE", combinedRouter, "/:id", "delete", { params: { id: "50" } }],
    ["combined booking status PATCH", combinedRouter, "/:id/status", "patch", { params: { id: "50" }, body: { status: "Confirmed" } }],
];

for (const [label, router, path, method, requestParts] of guardedRoutes) {
    test(`assigned Staff may proceed through ${label} access guard`, async () => {
        const guard = restaurantGuardFor(routeFor(router, path, method));
        assert.equal(typeof guard, "function");
        await withAccessFetch([2, 3], async () => {
            const result = await invoke(guard, { ...request(), ...requestParts, auth: request().auth });
            assert.equal(result.statusCode, 200);
            assert.equal(result.nextCalled, true);
        });
    });

    test(`unassigned Staff is blocked from ${label}`, async () => {
        const guard = restaurantGuardFor(routeFor(router, path, method));
        assert.equal(typeof guard, "function");
        await withAccessFetch([], async () => {
            const result = await invoke(guard, { ...request(), ...requestParts, auth: request().auth });
            assert.equal(result.statusCode, 403);
            assert.deepEqual(result.body, { message: "Not assigned to this restaurant" });
            assert.equal(result.nextCalled, false);
        });
    });
}

test("Staff cannot move an assigned table to an unassigned restaurant", async () => {
    const guard = restaurantGuardFor(routeFor(tableRouter, "/:id", "put"));
    await withAccessFetch([2], async (requests) => {
        const result = await invoke(guard, request("Staff", { id: "20" }, { restaurant_id: 3 }));
        assert.equal(result.statusCode, 403);
        assert.equal(result.body.message, "Not assigned to this restaurant");
        assert.equal(result.nextCalled, false);
        assert.equal(requests.filter((entry) => entry.table === "staff_restaurant_assignment").length, 2);
    }, { tableRestaurantId: 2 });
});

test("Admin bypasses restaurant assignment lookups and Customer behavior is unchanged", async () => {
    for (const roleName of ["Admin", "Customer"]) {
        const guard = restaurantGuardFor(routeFor(restaurantRouter, "/:id", "put"));
        await withAccessFetch([], async (requests) => {
            const result = await invoke(guard, request(roleName, { id: "2" }));
            assert.equal(result.nextCalled, true);
            assert.equal(requests.length, 0);
        });
    }
});

test("Staff is forbidden from creating or deleting restaurants", async () => {
    for (const [router, path, method] of [[restaurantRouter, "/", "post"], [restaurantRouter, "/:id", "delete"]]) {
        const route = routeFor(router, path, method);
        const staffResult = await invoke(route.stack[1].handle, request("Staff"));
        assert.equal(staffResult.statusCode, 403);
        assert.equal(staffResult.body.message, "Insufficient permissions");
        assert.equal(staffResult.nextCalled, false);
        const adminResult = await invoke(route.stack[1].handle, request("Admin"));
        assert.equal(adminResult.nextCalled, true);
    }
});

test("Staff reservation list keeps all hotels and filters restaurant reservations to assignments", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        if (table === "staff_restaurant_assignment") return jsonResponse([{ restaurant_id: 2 }]);
        return jsonResponse([
            { reservation_id: 1, reservation_type: "HOTEL", restaurant_table: null },
            { reservation_id: 2, reservation_type: "RESTAURANT", restaurant_table: { restaurant_id: 2 } },
            { reservation_id: 3, reservation_type: "RESTAURANT", restaurant_table: { restaurant_id: 3 } },
        ]);
    };
    try {
        const res = response();
        await reservationController.getReservationsController(request("Staff"), res);
        assert.deepEqual(res.body.map((reservation) => reservation.reservation_id), [1, 2]);

        const customerResponse = response();
        await reservationController.getReservationsController(request("Customer"), customerResponse);
        assert.deepEqual(customerResponse.body.map((reservation) => reservation.reservation_id), [1, 2, 3]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Staff is forbidden and Admin is allowed on staff-assignment routes", async () => {
    for (const roleName of ["Staff", "Customer"]) {
        const result = await invoke(requireStaffAssignmentAdmin, request(roleName));
        assert.equal(result.statusCode, 403);
        assert.equal(result.body.message, "Insufficient permissions");
    }
    const adminResult = await invoke(requireStaffAssignmentAdmin, request("Admin"));
    assert.equal(adminResult.nextCalled, true);
    assert.deepEqual(staffAssignmentRouter.stack.filter((layer) => layer.route).map((layer) => layer.route.path), ["/", "/", "/:userId/:restaurantId"]);
});

const assignmentPayload = { user_id: "00000000-0000-4000-8000-000000000001", restaurant_id: 2 };

for (const roleName of ["Admin", "Staff"]) {
    test(`assertRestaurantAccess rejects invalid restaurant IDs for ${roleName} before querying`, async () => {
        const originalFetch = globalThis.fetch;
        let queried = false;
        globalThis.fetch = async () => { queried = true; throw new Error("Unexpected database request"); };
        try {
            await assert.rejects(
                assertRestaurantAccess(request(roleName), Number.NaN),
                (error) => error.statusCode === 400 && error.message === "Invalid restaurant id",
            );
            assert.equal(queried, false);
        } finally { globalThis.fetch = originalFetch; }
    });
}

const invokeController = async (controller, req) => {
    const res = response();
    const originalError = console.error;
    console.error = () => undefined;
    try { await controller(req, res); } finally { console.error = originalError; }
    return res;
};

test("A4 assignment creation rejects invalid IDs before database access", async () => {
    for (const body of [{ ...assignmentPayload, user_id: "bad" }, { ...assignmentPayload, restaurant_id: 0 }]) {
        const originalFetch = globalThis.fetch;
        let called = false;
        globalThis.fetch = async () => { called = true; throw new Error("Unexpected database request"); };
        try {
            const result = await invokeController(assignmentController.createStaffAssignmentController, request("Admin", {}, body));
            assert.equal(result.statusCode, 400);
            assert.equal(called, false);
        } finally { globalThis.fetch = originalFetch; }
    }
});

test("A4 assignment creation rejects non-Staff users and missing restaurants", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        if (table === "user") return jsonResponse({ role: [{ role_name: "Customer" }] });
        if (table === "restaurant") return jsonResponse(null);
        return jsonResponse([]);
    };
    try {
        const notStaff = await invokeController(assignmentController.createStaffAssignmentController, request("Admin", {}, assignmentPayload));
        assert.equal(notStaff.statusCode, 400);
        assert.equal(notStaff.body.message, "User is not Staff");

        globalThis.fetch = async (input) => {
            const table = new URL(String(input)).pathname.split("/").at(-1);
            if (table === "user") return jsonResponse({ role: [{ role_name: "Staff" }] });
            if (table === "restaurant") return jsonResponse(null);
            return jsonResponse([]);
        };
        const missingRestaurant = await invokeController(assignmentController.createStaffAssignmentController, request("Admin", {}, assignmentPayload));
        assert.equal(missingRestaurant.statusCode, 400);
        assert.equal(missingRestaurant.body.message, "Restaurant does not exist");
    } finally { globalThis.fetch = originalFetch; }
});

test("A4 duplicate assignment returns 409 and deleting a missing assignment returns 404", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        if (table === "user") return jsonResponse({ role: [{ role_name: "Staff" }] });
        if (table === "restaurant") return jsonResponse({ restaurant_id: 2 });
        if (table === "staff_restaurant_assignment" && method === "POST") return jsonResponse({ code: "23505", message: "duplicate key" }, 409);
        if (table === "staff_restaurant_assignment" && method === "DELETE") return jsonResponse(null);
        return jsonResponse([]);
    };
    try {
        const duplicate = await invokeController(assignmentController.createStaffAssignmentController, request("Admin", {}, assignmentPayload));
        assert.equal(duplicate.statusCode, 409);
        assert.equal(duplicate.body.message, "Already assigned");

        const missing = await invokeController(assignmentController.deleteStaffAssignmentController, request("Admin", { userId: assignmentPayload.user_id, restaurantId: "2" }));
        assert.equal(missing.statusCode, 404);
        assert.equal(missing.body.message, "Assignment not found");
    } finally { globalThis.fetch = originalFetch; }
});

test("A4 Admin can list and create staff assignments", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        requests.push({ table, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
        if (table === "staff_restaurant_assignment" && method === "GET") {
            return jsonResponse([{ user_id: assignmentPayload.user_id, restaurant_id: 2 }]);
        }
        if (table === "user") return jsonResponse({ role: { role_name: "Staff" } });
        if (table === "restaurant") return jsonResponse({ restaurant_id: 2 });
        if (table === "staff_restaurant_assignment" && method === "POST") {
            return jsonResponse({ ...assignmentPayload, created_at: "2026-11-04T00:00:00Z" }, 201);
        }
        return jsonResponse([]);
    };
    try {
        const list = await invokeController(assignmentController.getStaffAssignmentsController, request("Admin"));
        assert.equal(list.statusCode, 200);
        assert.equal(list.body[0].restaurant_id, 2);

        const created = await invokeController(assignmentController.createStaffAssignmentController, request("Admin", {}, assignmentPayload));
        assert.equal(created.statusCode, 201);
        assert.deepEqual(requests.find((entry) => entry.table === "staff_restaurant_assignment" && entry.method === "POST")?.body, assignmentPayload);
    } finally { globalThis.fetch = originalFetch; }
});
