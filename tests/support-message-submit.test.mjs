import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: supportMessageRouter }, { runWithRequest }] = await Promise.all([
    import("../dist/routes/support-message.routes.js"),
    import("../dist/config/supabase.js"),
]);

const roleId = { Customer: 1, Staff: 2, Admin: 3 };
const jsonResponse = (body, status = 200, contentType = "application/json") => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
});

const invokeSubmit = async ({ roleName, authenticated = true, databaseFailure = false } = {}) => {
    const routeLayer = supportMessageRouter.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post);
    assert.ok(routeLayer, "POST / support message route exists");
    const route = routeLayer.route;
    const authLayer = supportMessageRouter.stack.find((layer) => !layer.route);
    assert.ok(authLayer, "router authentication middleware exists");
    const accessToken = "support-test-access-token";
    const headers = authenticated ? { authorization: `Bearer ${accessToken}` } : {};
    const req = {
        method: "POST",
        originalUrl: "/api/support-messages",
        baseUrl: "/api/support-messages",
        path: "/",
        headers,
        body: { subject: "Help", message: "Please contact me" },
        query: {},
        params: {},
        get(name) { return headers[name.toLowerCase()]; },
    };
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        set() { return this; },
        cookie() { return this; },
        clearCookie() { return this; },
    };
    const calls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = String(init.method ?? "GET").toUpperCase();
        const requestHeaders = new Headers(init.headers);
        calls.push({ url, method, headers: requestHeaders, body: init.body ? JSON.parse(String(init.body)) : undefined });

        if (url.pathname === "/auth/v1/user") {
            return jsonResponse({ id: "customer-123", email: "customer@example.test" });
        }
        if (url.pathname === "/rest/v1/user") {
            return jsonResponse({ user_id: "customer-123", role_id: roleId[roleName], role: { role_name: roleName } }, 200, "application/vnd.pgrst.object+json");
        }
        if (url.pathname === "/rest/v1/support_message" && method === "POST") {
            if (databaseFailure) {
                return jsonResponse({ code: "XX000", message: "sensitive database details", details: "private detail", hint: "internal hint" }, 500);
            }
            return jsonResponse({
                support_message_id: 23,
                customer_id: "customer-123",
                subject: "Help",
                message: "Please contact me",
                status: "open",
                created_at: "2026-11-27T00:00:00Z",
                updated_at: "2026-11-27T00:00:00Z",
            }, 201, "application/vnd.pgrst.object+json");
        }
        throw new Error(`Unexpected backend request: ${method} ${url.pathname}`);
    };

    const handlers = [authLayer.handle, ...route.stack.map((layer) => layer.handle)];
    const run = async (index = 0) => {
        if (index >= handlers.length) return;
        let advanced = false;
        await new Promise((resolve, reject) => {
            try {
                Promise.resolve(handlers[index](req, res, () => {
                    advanced = true;
                    resolve();
                })).then(() => { if (!advanced) resolve(); }, reject);
            } catch (error) {
                reject(error);
            }
        });
        if (advanced) await run(index + 1);
    };

    try {
        await new Promise((resolve, reject) => runWithRequest(req, () => run().then(resolve, reject)));
    } finally {
        globalThis.fetch = previousFetch;
    }
    return { response: res, calls };
};

test("Customer can submit and gets an open message owned by their authenticated identity", async () => {
    const { response, calls } = await invokeSubmit({ roleName: "Customer" });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.status, "open");
    assert.equal(response.body.customer_id, "customer-123");
    const insert = calls.find((call) => call.url.pathname === "/rest/v1/support_message");
    assert.ok(insert);
    assert.equal(insert.headers.get("authorization"), "Bearer support-test-access-token");
    assert.deepEqual(insert.body, {
        customer_id: "customer-123",
        subject: "Help",
        message: "Please contact me",
        status: "open",
    });
});

for (const roleName of ["Staff", "Admin"]) {
    test(`${roleName} is denied from support message submission`, async () => {
        const { response, calls } = await invokeSubmit({ roleName });

        assert.equal(response.statusCode, 403);
        assert.deepEqual(response.body, { message: "Insufficient permissions" });
        assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/support_message"), false);
    });
}

test("unauthenticated requests are denied from support message submission", async () => {
    const { response, calls } = await invokeSubmit({ authenticated: false });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { message: "Authentication required" });
    assert.equal(calls.length, 0);
});

test("database failures return a generic 500 without database details", async () => {
    const { response } = await invokeSubmit({ roleName: "Customer", databaseFailure: true });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: "Failed to submit support message" });
    assert.equal(JSON.stringify(response.body).includes("sensitive database details"), false);
    assert.equal(JSON.stringify(response.body).includes("private detail"), false);
});
