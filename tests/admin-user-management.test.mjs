import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: adminUsersRouter }, controller] = await Promise.all([
    import("../dist/routes/admin-user.routes.js"),
    import("../dist/controllers/admin-user.controller.js"),
]);

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const roleRow = (role_name, role_id = 9) => ({ role_id, role_name });
const userRow = (user_id = USER_ID, role_name = "Customer", role_id = 3) => ({
    user_id,
    first_name: "Pat",
    last_name: "Lee",
    email: "pat@example.test",
    role_id,
    role: roleRow(role_name, role_id),
});

const makeResponse = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const request = (body = {}, params = {}, roleName = "Admin", userId = ADMIN_ID) => ({
    body,
    params,
    query: {},
    headers: {},
    auth: { roleName, user: { id: userId }, accessToken: "admin-token" },
});

const invokeController = async (handler, req) => {
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    const originalError = console.error;
    console.error = () => undefined;
    try { await handler(req, res); } finally { console.error = originalError; }
    return res;
};

const apiHandler = ({ target = userRow(), targetMissing = false, roleId = 27, assignmentDeleteError = false } = {}) => {
    const requests = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ table, method, url, body });

        if (table === "user" && method === "GET") {
            if (url.searchParams.get("select")?.startsWith("user_id,first_name")) {
                assert.match(url.searchParams.get("select"), /email,role\(role_name\)/);
                return makeResponse([{ user_id: USER_ID, first_name: "Pat", last_name: "Lee", email: "pat@example.test", role: { role_name: "Staff" }, access_token: "must-not-return" }]);
            }
            return makeResponse(targetMissing ? null : target);
        }
        if (table === "role" && method === "GET") return makeResponse({ role_id: roleId, role_name: "Staff" });
        if (table === "user" && method === "PATCH") return makeResponse({ user_id: target.user_id ?? USER_ID });
        if (table === "staff_restaurant_assignment" && method === "DELETE") {
            if (assignmentDeleteError) return makeResponse({ message: "internal database detail" }, 500);
            return makeResponse(null, 204);
        }
        throw new Error(`Unexpected ${method} ${url}`);
    };
    return { fetch, requests };
};

test("GET /admin/users returns only the approved safe fields and role name", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler();
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.getAdminUsersController, request());
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, [{ user_id: USER_ID, first_name: "Pat", last_name: "Lee", email: "pat@example.test", role: "Staff" }]);
        assert.equal(Object.hasOwn(response.body[0], "access_token"), false);
    } finally { globalThis.fetch = originalFetch; }
});

test("unexpected query failures return a safe message-only 500", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => makeResponse({ message: "sensitive database detail" }, 500);
    const originalError = console.error;
    console.error = () => undefined;
    try {
        const response = await invokeController(controller.getAdminUsersController, request());
        assert.equal(response.statusCode, 500);
        assert.deepEqual(response.body, { message: "Failed to retrieve users" });
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
    }
});

for (const [label, body, expectedMessage] of [
    ["invalid UUID", { role: "Staff" }, "Invalid user id"],
    ["invalid role", { role: "Admin" }, "Invalid role"],
    ["missing role", {}, "Invalid role"],
]) {
    test(`role update rejects ${label} before database access`, async () => {
        const originalFetch = globalThis.fetch;
        let queried = false;
        globalThis.fetch = async () => { queried = true; throw new Error("Unexpected request"); };
        try {
            const userId = label === "invalid UUID" ? "bad-id" : USER_ID;
            const response = await invokeController(controller.updateAdminUserRoleController, request(body, { userId }));
            assert.equal(response.statusCode, 400);
            assert.equal(response.body.message, expectedMessage);
            assert.equal(queried, false);
        } finally { globalThis.fetch = originalFetch; }
    });
}

test("role update returns 404 when the target user is missing", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler({ targetMissing: true });
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Staff" }, { userId: USER_ID }));
        assert.equal(response.statusCode, 404);
        assert.deepEqual(response.body, { message: "User not found" });
    } finally { globalThis.fetch = originalFetch; }
});

for (const [label, target, actorId, message] of [
    ["self", userRow(ADMIN_ID, "Staff", 2), ADMIN_ID, "Cannot change your own role"],
    ["Admin target", userRow(USER_ID, "Admin", 1), ADMIN_ID, "Cannot change an Admin's role"],
]) {
    test(`role update rejects ${label}`, async () => {
        const originalFetch = globalThis.fetch;
        const db = apiHandler({ target });
        globalThis.fetch = db.fetch;
        try {
            const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Customer" }, { userId: target.user_id }, "Admin", actorId));
            assert.equal(response.statusCode, 400);
            assert.deepEqual(response.body, { message });
            assert.equal(db.requests.some((entry) => entry.method === "PATCH"), false);
        } finally { globalThis.fetch = originalFetch; }
    });
}

test("Staff to Customer is a no-op when the target already has the requested role", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler({ target: userRow(USER_ID, "Staff", 2) });
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Staff" }, { userId: USER_ID }));
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { user_id: USER_ID, role: "Staff" });
        assert.equal(db.requests.some((entry) => entry.table === "role" || entry.method === "PATCH"), false);
    } finally { globalThis.fetch = originalFetch; }
});

test("promoting a Customer looks up the Staff role_id by name before updating", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler({ target: userRow(USER_ID, "Customer", 3), roleId: 27 });
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Staff" }, { userId: USER_ID }));
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { user_id: USER_ID, role: "Staff" });
        assert.ok(db.requests.findIndex((entry) => entry.table === "role") < db.requests.findIndex((entry) => entry.method === "PATCH"));
        assert.deepEqual(db.requests.find((entry) => entry.method === "PATCH")?.body, { role_id: 27 });
    } finally { globalThis.fetch = originalFetch; }
});

test("demoting Staff updates role before deleting restaurant assignments", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler({ target: userRow(USER_ID, "Staff", 2), roleId: 44 });
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Customer" }, { userId: USER_ID }));
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { user_id: USER_ID, role: "Customer" });
        const updateIndex = db.requests.findIndex((entry) => entry.method === "PATCH");
        const deleteIndex = db.requests.findIndex((entry) => entry.table === "staff_restaurant_assignment" && entry.method === "DELETE");
        assert.ok(updateIndex >= 0 && deleteIndex > updateIndex);
        assert.equal(db.requests[deleteIndex].url.searchParams.get("user_id"), `eq.${USER_ID}`);
    } finally { globalThis.fetch = originalFetch; }
});

test("assignment cleanup failure does not undo demotion or expose database details", async () => {
    const originalFetch = globalThis.fetch;
    const db = apiHandler({ target: userRow(USER_ID, "Staff", 2), roleId: 44, assignmentDeleteError: true });
    globalThis.fetch = db.fetch;
    try {
        const response = await invokeController(controller.updateAdminUserRoleController, request({ role: "Customer" }, { userId: USER_ID }));
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, { user_id: USER_ID, role: "Customer" });
        assert.equal(JSON.stringify(response.body).includes("internal database detail"), false);
    } finally { globalThis.fetch = originalFetch; }
});

test("Staff and Customer are forbidden from both Admin user routes", async () => {
    for (const route of [
        adminUsersRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.get)?.route,
        adminUsersRouter.stack.find((layer) => layer.route?.path === "/:userId/role" && layer.route.methods.patch)?.route,
    ]) {
        assert.ok(route);
        for (const roleName of ["Staff", "Customer"]) {
            const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
            let nextCalled = false;
            route.stack[0].handle(request({}, {}, roleName), res, () => { nextCalled = true; });
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, { message: "Insufficient permissions" });
            assert.equal(nextCalled, false);
        }
    }
});
