import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ getDashboardController }, { runWithRequest }] = await Promise.all([
    import("../dist/controllers/dashboard.controller.js"),
    import("../dist/config/supabase.js"),
]);

const USER_ID = "00000000-0000-4000-8000-000000000002";
const response = (body) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": `0-0/${Array.isArray(body) ? body.length : 1}` },
});

const request = (roleName) => ({
    body: {}, params: {}, query: {}, headers: {},
    auth: { roleName, user: { id: USER_ID }, accessToken: "request-token" },
});

const invoke = async (handler, req) => {
    const res = {
        statusCode: 200, body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    await new Promise((resolve) => runWithRequest(req, () => handler(req, res).then(resolve)));
    return res;
};

const dbFetch = () => {
    const calls = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        calls.push({ table, url, method: init.method ?? "GET" });
        const datasets = {
            staff_restaurant_assignment: [{ restaurant_id: 7, user_id: USER_ID }],
            hotel: [{ hotel_id: 1 }, { hotel_id: 2 }],
            restaurant: [{ restaurant_id: 7 }, { restaurant_id: 8 }],
            room: [
                { room_id: 1, status: "Available" }, { room_id: 2, status: "Reserved" },
                { room_id: 3, status: "Occupied" }, { room_id: 4, status: "Maintenance" },
            ],
            restaurant_table: [
                { table_id: 21, restaurant_id: 7, status: "Available" },
                { table_id: 22, restaurant_id: 7, status: "Maintenance" },
                { table_id: 31, restaurant_id: 8, status: "Reserved" },
            ],
            reservation: [
                { reservation_id: 1, reservation_type: "HOTEL", status: "Confirmed" },
                { reservation_id: 2, reservation_type: "RESTAURANT", table_id: 21, status: "Pending" },
                { reservation_id: 3, reservation_type: "RESTAURANT", table_id: 31, status: "Cancelled" },
            ],
            combined_booking: [],
            notification: [],
        };
        let rows = datasets[table];
        if (!rows) throw new Error(`Unexpected ${init.method ?? "GET"} ${url}`);
        for (const [key, raw] of url.searchParams) {
            if (raw.startsWith("eq.")) rows = rows.filter((row) => String(row[key]) === raw.slice(3));
            if (raw.startsWith("in.(")) {
                const ids = raw.slice(4, -1).split(",");
                rows = rows.filter((row) => ids.includes(String(row[key])));
            }
        }
        if (init.method === "HEAD") {
            return new Response(null, { status: 200, headers: { "Content-Range": `0-0/${rows.length}` } });
        }
        return response(rows);
    };
    return { fetch, calls };
};

const withFetch = async (db, callback) => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = db.fetch;
    try { return await callback(); } finally { globalThis.fetch = oldFetch; }
};

test("Admin dashboard totals include all assigned and unassigned restaurant data", async () => {
    const db = dbFetch();
    await withFetch(db, async () => {
        const result = await invoke(getDashboardController, request("Admin"));
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.restaurants, 2);
        assert.equal(result.body.tables, 3);
        assert.equal(result.body.availableTables, 1);
        assert.equal(result.body.reservedTables, 1);
        assert.equal(result.body.maintenanceTables, 1);
        assert.equal(result.body.reservations, 3);
        assert.equal(result.body.cancelledReservations, 1);
        assert.equal(db.calls.some((call) => call.table === "staff_restaurant_assignment"), false);
        const tables = db.calls.filter((call) => call.table === "restaurant_table");
        assert.ok(tables.some((call) => !call.url.searchParams.has("restaurant_id")));
    });
});

test("Staff dashboard keeps room totals global and scopes restaurant data to assignments", async () => {
    const db = dbFetch();
    await withFetch(db, async () => {
        const result = await invoke(getDashboardController, request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.rooms, 4);
        assert.equal(result.body.availableRooms, 1);
        assert.equal(result.body.reservedRooms, 1);
        assert.equal(result.body.occupiedRooms, 1);
        assert.equal(result.body.maintenanceRooms, 1);
        assert.equal(result.body.restaurants, 1);
        assert.equal(result.body.tables, 2);
        assert.equal(result.body.availableTables, 1);
        assert.equal(result.body.reservedTables, 0);
        assert.equal(result.body.maintenanceTables, 1);
        assert.equal(result.body.reservations, 2);
        assert.equal(result.body.pendingReservations, 1);
        assert.equal(result.body.cancelledReservations, 0);
        assert.equal(db.calls.some((call) => call.table === "staff_restaurant_assignment"), true);
        const tables = db.calls.filter((call) => call.table === "restaurant_table");
        assert.ok(tables.some((call) => call.url.searchParams.get("restaurant_id") === "in.(7)"));
        assert.ok(tables.filter((call) => call.url.searchParams.has("status")).every((call) => call.url.searchParams.get("table_id") === "in.(21,22)"));
    });
});

test("Staff with no restaurant assignments retains rooms and receives zero restaurant totals", async () => {
    const db = dbFetch();
    const originalFetch = db.fetch;
    db.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("staff_restaurant_assignment")) return response([]);
        return originalFetch(input, init);
    };
    await withFetch(db, async () => {
        const result = await invoke(getDashboardController, request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.rooms, 4);
        assert.equal(result.body.restaurants, 0);
        assert.equal(result.body.tables, 0);
        assert.equal(db.calls.some((call) => call.table === "restaurant_table"), false);
    });
});

