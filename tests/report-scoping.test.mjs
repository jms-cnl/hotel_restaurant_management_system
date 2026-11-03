import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ default: reportRouter }, controller, auth] = await Promise.all([
    import("../dist/routes/report.routes.js"),
    import("../dist/controllers/report.controller.js"),
    import("../dist/middleware/auth.middleware.js"),
]);

const USER_ID = "00000000-0000-4000-8000-000000000002";
const hotelReservation = { reservation_id: 1, reservation_type: "HOTEL", status: "Confirmed", room_id: 5, table_id: null, combined_booking_id: 9, check_in_date: "2026-11-01", check_out_date: "2026-11-03", room: { price_per_night: 100 } };
const assignedRestaurantReservation = { reservation_id: 2, reservation_type: "RESTAURANT", status: "Pending", room_id: null, table_id: 21, combined_booking_id: 9, reservation_date: "2026-11-02", restaurant_table: { restaurant_id: 7 } };
const otherRestaurantReservation = { reservation_id: 3, reservation_type: "RESTAURANT", status: "Pending", room_id: null, table_id: 31, combined_booking_id: null, reservation_date: "2026-11-02", restaurant_table: { restaurant_id: 8 } };

const response = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": `0-${Array.isArray(body) ? Math.max(0, body.length - 1) : 0}/${Array.isArray(body) ? body.length : 1}` },
});

const dbFetch = ({ assignments = [7], reservations = [hotelReservation, assignedRestaurantReservation, otherRestaurantReservation] } = {}) => {
    const calls = [];
    const fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        calls.push({ table, url, method: init.method ?? "GET" });
        if (table === "staff_restaurant_assignment") return response(assignments.map((restaurant_id) => ({ restaurant_id })));
        if (table === "restaurant_table") {
            const ids = url.searchParams.get("restaurant_id")?.replace(/^in\./, "").replace(/[()]/g, "").split(",").map(Number) ?? [];
            return response(ids.flatMap((id) => id === 7 ? [{ table_id: 21 }] : id === 8 ? [{ table_id: 31 }] : []));
        }
        if (table === "room") return response([{ room_id: 5, hotel_id: 2 }]);
        if (table === "reservation") {
            let rows = [...reservations];
            const type = url.searchParams.get("reservation_type");
            if (type) rows = rows.filter((row) => row.reservation_type === type.replace(/^eq\./, ""));
            const roomIds = url.searchParams.get("room_id");
            if (roomIds?.startsWith("in.")) rows = rows.filter((row) => roomIds.includes(String(row.room_id)));
            const tableIds = url.searchParams.get("table_id");
            if (tableIds?.startsWith("in.")) rows = rows.filter((row) => tableIds.includes(String(row.table_id)));
            if (tableIds?.startsWith("eq.")) rows = rows.filter((row) => String(row.table_id) === tableIds.slice(3));
            const or = url.searchParams.get("or");
            if (or) rows = rows.filter((row) => row.reservation_type === "HOTEL" || (row.reservation_type === "RESTAURANT" && or.includes(String(row.table_id))));
            return response(rows);
        }
        throw new Error(`Unexpected ${init.method ?? "GET"} ${url}`);
    };
    return { fetch, calls };
};

const request = (roleName = "Staff", query = {}) => ({
    body: {}, params: {}, query, headers: {},
    auth: { roleName, user: { id: USER_ID }, accessToken: "request-token" },
});

const invoke = async (handler, req) => {
    const res = {
        statusCode: 200, body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    const previous = console.error;
    console.error = () => undefined;
    try { await handler(req, res); } finally { console.error = previous; }
    return res;
};

const withFetch = async (db, callback) => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = db.fetch;
    try { return await callback(); } finally { globalThis.fetch = oldFetch; }
};

const getRoute = (path) => reportRouter.stack.find((layer) => layer.route?.path === path).route;

test("report routes authenticate before role guards; revenue is Admin-only", () => {
    for (const path of ["/reservations", "/occupancy", "/tables"]) {
        const route = getRoute(path);
        assert.equal(route.stack[0].handle, auth.authenticate);
        let staffPassed = false;
        route.stack[1].handle(request("Staff"), { status() { return this; }, json() {} }, () => { staffPassed = true; });
        assert.equal(staffPassed, true);
    }
    const revenue = getRoute("/revenue");
    assert.equal(revenue.stack[0].handle, auth.authenticate);
    let staffPassed = false;
    let adminPassed = false;
    const staffResponse = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
    revenue.stack[1].handle(request("Staff"), staffResponse, () => { staffPassed = true; });
    revenue.stack[1].handle(request("Admin"), { status() { return this; }, json() {} }, () => { adminPassed = true; });
    assert.equal(staffPassed, false);
    assert.equal(staffResponse.statusCode, 403);
    assert.equal(adminPassed, true);
});

test("Staff cannot access revenue while Admin can", async () => {
    const revenue = getRoute("/revenue");
    const db = dbFetch();
    await withFetch(db, async () => {
        const staffRes = await invoke(revenue.stack[1].handle, request("Staff"));
        assert.equal(staffRes.statusCode, 403);
        const adminRes = await invoke(controller.getRevenueReportController, request("Admin"));
        assert.equal(adminRes.statusCode, 200);
    });
});

test("Staff reservations include hotel rows and only assigned restaurant table ids in the query", async () => {
    const db = dbFetch();
    await withFetch(db, async () => {
        const result = await invoke(controller.getReservationReportController, request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body.reservations.map((row) => row.reservation_id), [1, 2]);
        const reservationQuery = db.calls.find((call) => call.table === "reservation");
        assert.match(reservationQuery.url.searchParams.get("or") ?? "", /table_id\.in/);
        assert.match(reservationQuery.url.searchParams.get("or") ?? "", /21/);
        assert.doesNotMatch(reservationQuery.url.searchParams.get("or") ?? "", /31/);
        assert.equal(result.body.summary.totalReservations, 2);
    });
});

test("Staff table report includes only assigned restaurant rows and scopes its summary", async () => {
    const db = dbFetch();
    await withFetch(db, async () => {
        const result = await invoke(controller.getTableReportController, request("Staff"));
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body.reservations.map((row) => row.reservation_id), [2]);
        assert.equal(result.body.summary.totalTableReservations, 1);
        const reservationQuery = db.calls.find((call) => call.table === "reservation");
        assert.equal(reservationQuery.url.searchParams.get("reservation_type"), "eq.RESTAURANT");
        assert.match(reservationQuery.url.searchParams.get("table_id") ?? "", /21/);
        assert.doesNotMatch(reservationQuery.url.searchParams.get("table_id") ?? "", /31/);
    });
});

test("Staff cannot filter reservation reports to an unassigned restaurant", async () => {
    const db = dbFetch();
    await withFetch(db, async () => {
        const result = await invoke(controller.getReservationReportController, request("Staff", { restaurant_id: "8" }));
        assert.equal(result.statusCode, 403);
        assert.deepEqual(result.body, { message: "Not assigned to this restaurant" });
        assert.equal(db.calls.some((call) => call.table === "reservation"), false);
    });
});

test("Staff with zero assignments get 200 and no restaurant rows, without an empty IN filter", async () => {
    const db = dbFetch({ assignments: [] });
    await withFetch(db, async () => {
        const reservations = await invoke(controller.getReservationReportController, request("Staff"));
        assert.equal(reservations.statusCode, 200);
        assert.deepEqual(reservations.body.reservations.map((row) => row.reservation_type), ["HOTEL"]);
        const tableReport = await invoke(controller.getTableReportController, request("Staff"));
        assert.equal(tableReport.statusCode, 200);
        assert.deepEqual(tableReport.body.reservations, []);
        assert.equal(tableReport.body.summary.totalTableReservations, 0);
        assert.equal(db.calls.some((call) => call.table === "reservation" && call.url.searchParams.get("table_id") === "in.()"), false);
    });
});

test("Admin reservation and table reports are not assignment-scoped", async () => {
    const db = dbFetch({ assignments: [] });
    await withFetch(db, async () => {
        const reservations = await invoke(controller.getReservationReportController, request("Admin"));
        assert.equal(reservations.statusCode, 200);
        assert.equal(reservations.body.reservations.length, 3);
        const tables = await invoke(controller.getTableReportController, request("Admin"));
        assert.equal(tables.statusCode, 200);
        assert.equal(tables.body.reservations.length, 2);
    });
});
