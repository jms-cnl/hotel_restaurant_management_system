import assert from "node:assert/strict";
import test from "node:test";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";
const [{ default: supportMessageRouter }, { runWithRequest }] = await Promise.all([
    import("../dist/routes/support-message.routes.js"),
    import("../dist/config/supabase.js"),
]);
const roleId = { Customer: 1, Staff: 2, Admin: 3 };
const customer = { first_name: "Ada", last_name: "Customer", email: "ada@example.test" };
const message = { support_message_id: 23, customer_id: "customer-123", customer, subject: "Help", message: "Please call", status: "open" };
const jsonResponse = (body, status = 200, contentType = "application/json") => new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });
const invoke = async ({ method = "GET", path = "/", roleName = "Admin", authenticated = true, status, result = [message], failure = false } = {}) => {
    const routePath = path === "/23" ? "/:id" : path === "/23/status" ? "/:id/status" : path;
    const layer = supportMessageRouter.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method.toLowerCase()]);
    assert.ok(layer, `${method} ${path} support message route exists`);
    const authLayer = supportMessageRouter.stack.find((entry) => !entry.route);
    assert.ok(authLayer, "router authentication middleware exists");
    const headers = authenticated ? { authorization: "Bearer support-admin-test-token" } : {};
    const req = {
        method, originalUrl: `/api/support-messages${path === "/" ? "" : path}`, baseUrl: "/api/support-messages", path,
        headers, body: status === undefined ? {} : { status }, query: {}, params: path === "/" ? {} : { id: "23" }, get(name) { return headers[name.toLowerCase()]; },
    };
    const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set() { return this; }, cookie() { return this; }, clearCookie() { return this; } };
    const calls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const requestMethod = String(init.method ?? "GET").toUpperCase();
        calls.push({ url, method: requestMethod, body: init.body ? JSON.parse(String(init.body)) : undefined });
        if (url.pathname === "/auth/v1/user") return jsonResponse({ id: `${roleName.toLowerCase()}-123`, email: "admin@example.test" });
        if (url.pathname === "/rest/v1/user") return jsonResponse({ user_id: `${roleName.toLowerCase()}-123`, role_id: roleId[roleName], role: { role_name: roleName } }, 200, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message") {
            if (failure) return jsonResponse({ message: "sensitive database details", details: "private" }, 500);
            if (result === null) return jsonResponse({ code: "PGRST116", message: "No rows found" }, 406);
            const responseData = requestMethod === "PATCH" ? result : path === "/23/status"
                ? { ...message, status: status === "resolved" ? "open" : "resolved" } : result;
            return jsonResponse(responseData, 200, Array.isArray(responseData) ? "application/json" : "application/vnd.pgrst.object+json");
        }
        if (url.pathname === "/rest/v1/support_message_history" && requestMethod === "POST") return jsonResponse([], 201);
        if (url.pathname === "/rest/v1/support_message_admin_notification" && requestMethod === "PATCH") return new Response(null, { status: 204 });
        throw new Error(`Unexpected backend request: ${requestMethod} ${url.pathname}`);
    };
    const handlers = [authLayer.handle, ...layer.route.stack.map((entry) => entry.handle)];
    const run = async (index = 0) => {
        if (index >= handlers.length) return;
        let advanced = false;
        await new Promise((resolve, reject) => {
            try { Promise.resolve(handlers[index](req, res, () => { advanced = true; resolve(); })).then(() => { if (!advanced) resolve(); }, reject); }
            catch (error) { reject(error); }
        });
        if (advanced) await run(index + 1);
    };
    try { await new Promise((resolve, reject) => runWithRequest(req, () => run().then(resolve, reject))); }
    finally { globalThis.fetch = previousFetch; }
    return { response: res, calls };
};
test("Admin can list support messages with customer identity from the existing user relationship", async () => {
    const { response, calls } = await invoke({ result: [message] });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, [message]);
    const select = calls.find((call) => call.url.pathname === "/rest/v1/support_message").url.searchParams.get("select");
    assert.match(select, /customer:user!support_message_customer_id_fkey\(first_name,last_name,email\)/);
});
test("Admin can view a support message detail", async () => {
    const { response, calls } = await invoke({ path: "/23", result: message });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, message);
    const select = calls.find((call) => call.url.pathname === "/rest/v1/support_message").url.searchParams.get("select");
    assert.match(select, /customer:user!support_message_customer_id_fkey\(first_name,last_name,email\)/);
});
for (const [from, to] of [["open", "resolved"], ["resolved", "open"]]) {
    test(`Admin can change support message status from ${from} to ${to}`, async () => {
        const updated = { ...message, status: to };
        const { response, calls } = await invoke({ method: "PATCH", path: "/23/status", status: to, result: updated });
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.status, to);
        assert.deepEqual(response.body.customer, customer);
        const update = calls.find((call) => call.url.pathname === "/rest/v1/support_message" && call.method === "PATCH");
        assert.ok(update);
        assert.equal(update.body.status, to);
        assert.match(update.url.searchParams.get("select"), /customer:user!support_message_customer_id_fkey\(first_name,last_name,email\)/);
    });
}
for (const roleName of ["Customer", "Staff"]) {
    test(`${roleName} is denied from Admin support message routes`, async () => {
        for (const [method, path] of [["GET", "/"], ["GET", "/23"], ["PATCH", "/23/status"]]) {
            const { response, calls } = await invoke({ method, path, roleName, status: "resolved" });
            assert.equal(response.statusCode, 403);
            assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/support_message"), false);
        }
    });
}
test("unauthenticated requests are denied from Admin support message routes", async () => {
    const { response, calls } = await invoke({ authenticated: false });
    assert.equal(response.statusCode, 401);
    assert.equal(calls.length, 0);
});
test("status change rejects values other than open or resolved", async () => {
    const { response, calls } = await invoke({ method: "PATCH", path: "/23/status", status: "closed" });
    assert.equal(response.statusCode, 400);
    assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/support_message" && call.method === "PATCH"), false);
});
test("Admin receives 404 for an unknown support message", async () => {
    const { response } = await invoke({ path: "/23", result: null });
    assert.equal(response.statusCode, 404);
});
test("database failures return a generic error without database details", async () => {
    const { response } = await invoke({ failure: true });
    assert.equal(response.statusCode, 500);
    assert.equal(JSON.stringify(response.body).includes("sensitive database details"), false);
    assert.equal(JSON.stringify(response.body).includes("private"), false);
});
