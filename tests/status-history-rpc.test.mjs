import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ changeReservationStatus }, { changeCombinedBookingStatus }] = await Promise.all([
    import("../dist/services/reservation.service.js"),
    import("../dist/services/combined-booking.service.js"),
]);

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

test("reservation status writes use one atomic RPC before notifications", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const reservation = { reservation_id: 31, user_id: "owner-1", status: "Confirmed" };
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = String(init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method, body });
        if (url.pathname.endsWith("/rpc/change_reservation_status_with_history")) return jsonResponse(reservation);
        if (url.pathname === "/rest/v1/notification" && method === "POST") return new Response(null, { status: 201 });
        throw new Error(`Unexpected ${method} ${url.pathname}`);
    };
    try {
        const result = await changeReservationStatus(31, { status: "Confirmed", remarks: "approved" }, "staff-1");
        assert.deepEqual(result, reservation);
        const rpcCalls = calls.filter((call) => call.url.pathname.endsWith("/rpc/change_reservation_status_with_history"));
        assert.equal(rpcCalls.length, 1);
        assert.deepEqual(rpcCalls[0].body, {
            p_reservation_id: 31,
            p_status: "Confirmed",
            p_remarks: "approved",
            p_changed_by: "staff-1",
        });
        assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/reservation" && ["PATCH", "POST"].includes(call.method)), false);
        assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/reservation_status_history"), false);
        assert.ok(calls.findIndex((call) => call.url.pathname.endsWith("/rpc/change_reservation_status_with_history"))
            < calls.findIndex((call) => call.url.pathname === "/rest/v1/notification"));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("combined status and child history writes use one RPC and preserve parent response shape", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const parent = { combined_booking_id: 50, status: "Cancelled", user_id: "owner-1" };
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = String(init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method, body });
        if (url.pathname.endsWith("/rpc/change_combined_booking_status_with_history")) {
            return jsonResponse({
                combined_booking: parent,
                reservations: [{ reservation_id: 61, user_id: "owner-1" }, { reservation_id: 62, user_id: "owner-2" }],
            });
        }
        if (url.pathname === "/rest/v1/notification" && method === "POST") return new Response(null, { status: 201 });
        throw new Error(`Unexpected ${method} ${url.pathname}`);
    };
    try {
        const result = await changeCombinedBookingStatus(50, { status: "Cancelled", remarks: "requested" }, "staff-1");
        assert.deepEqual(result, parent);
        const rpcCalls = calls.filter((call) => call.url.pathname.endsWith("/rpc/change_combined_booking_status_with_history"));
        assert.equal(rpcCalls.length, 1);
        assert.deepEqual(rpcCalls[0].body, {
            p_combined_booking_id: 50,
            p_status: "Cancelled",
            p_remarks: "requested",
            p_changed_by: "staff-1",
        });
        assert.equal(calls.some((call) => ["/rest/v1/combined_booking", "/rest/v1/reservation", "/rest/v1/reservation_status_history"].includes(call.url.pathname)
            && ["PATCH", "POST", "GET"].includes(call.method)), false);
        assert.equal(calls.filter((call) => call.url.pathname === "/rest/v1/notification" && call.method === "POST").length, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

for (const [code, expectedStatus, message] of [["42501", 401, "database detail"], ["P0001", 403, "FORBIDDEN: update blocked"], ["P0002", 404, "database detail"], ["22023", 400, "database detail"], ["23P01", 409, "database detail"]]) {
    test(`reservation status RPC maps SQLSTATE ${code} to HTTP ${expectedStatus}`, async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => jsonResponse({ code, message, details: null, hint: null }, 400);
        try {
            await assert.rejects(
                changeReservationStatus(31, { status: "Confirmed" }, "staff-1"),
                (error) => error.statusCode === expectedStatus,
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
}

test("combined status RPC maps SQLSTATE errors to the same HTTP statuses", async () => {
    const originalFetch = globalThis.fetch;
    const codes = [["42501", 401, "database detail"], ["P0001", 403, "FORBIDDEN: update blocked"], ["P0002", 404, "database detail"], ["22023", 400, "database detail"], ["23P01", 409, "database detail"]];
    let selectedError = codes[0];
    globalThis.fetch = async () => jsonResponse({ code: selectedError[0], message: "database detail", details: null, hint: null }, 400);
    try {
        for (const [code, expectedStatus, message] of codes) {
            selectedError = [code, expectedStatus, message];
            globalThis.fetch = async () => jsonResponse({ code, message, details: null, hint: null }, 400);
            await assert.rejects(
                changeCombinedBookingStatus(50, { status: "Cancelled" }, "staff-1"),
                (error) => error.statusCode === expectedStatus,
            );
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
});
