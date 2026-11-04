import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: reservationRouter }, { runWithRequest }] = await Promise.all([
    import("../dist/routes/reservation.routes.js"),
    import("../dist/config/supabase.js"),
]);

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const invokeCustomerDelete = async (currentStatus) => {
    const route = reservationRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.delete)?.route;
    assert.ok(route, "DELETE /:id reservation route exists");

    const req = {
        method: "DELETE",
        params: { id: "12" },
        headers: { authorization: "Bearer request-token" },
        auth: { user: { id: "customer-1" }, accessToken: "request-token", roleName: "Customer" },
    };
    const res = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    const calls = [];
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        calls.push({ table, method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });

        if (table === "reservation" && method === "GET" && url.searchParams.get("select") === "user_id") {
            return jsonResponse({ user_id: "customer-1" });
        }
        if (url.pathname.endsWith("/rpc/change_reservation_status_with_history") && method === "POST") {
            if (["Rejected", "Completed"].includes(currentStatus)) {
                return jsonResponse({ code: "22023", message: "Invalid reservation status transition", details: null, hint: null }, 400);
            }
            return jsonResponse({ reservation_id: 12, user_id: "customer-1", status: "Cancelled" });
        }
        if (method === "POST") return new Response(null, { status: 201 });
        return jsonResponse([]);
    };
    console.error = () => undefined;

    const invokeHandlers = async (index) => {
        if (index >= route.stack.length) return;
        let advanced = false;
        await new Promise((resolve, reject) => {
            try {
                Promise.resolve(route.stack[index].handle(req, res, () => {
                    advanced = true;
                    resolve();
                })).then(() => resolve(), reject);
            } catch (error) {
                reject(error);
            }
        });
        if (advanced) await invokeHandlers(index + 1);
    };

    try {
        await new Promise((resolve, reject) => runWithRequest(req, () => invokeHandlers(0).then(resolve, reject)));
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
    }
    return { response: res, calls };
};

test("customer owner cancels through the atomic status-history RPC", async () => {
    const { response, calls } = await invokeCustomerDelete("Pending");

    assert.equal(response.statusCode, 200, JSON.stringify({ response, calls: calls.map((call) => ({ table: call.table, method: call.method, url: call.url.toString() })) }));
    assert.equal(response.body.status, "Cancelled");
    const statusRpcCalls = calls.filter((call) => call.url.pathname.endsWith("/rpc/change_reservation_status_with_history"));
    assert.equal(statusRpcCalls.length, 1);
    assert.deepEqual(statusRpcCalls[0].body, {
        p_reservation_id: 12,
        p_status: "Cancelled",
        p_remarks: "Reservation cancelled",
        p_changed_by: "customer-1",
    });
    assert.equal(calls.some((call) => call.table === "reservation_status_history"), false);
    assert.ok(calls.some((call) => call.table === "notification" && call.method === "POST"));
});

for (const status of ["Rejected", "Completed"]) {
    test(`customer owner cannot cancel a ${status} reservation`, async () => {
        const { response, calls } = await invokeCustomerDelete(status);

        assert.equal(response.statusCode, 400);
        assert.equal(calls.some((call) => call.url.pathname.endsWith("/rpc/change_reservation_status_with_history")), true);
        assert.equal(calls.some((call) => call.table === "reservation_status_history"), false);
    });
}
