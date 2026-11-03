import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ createCombinedBookingController, createHotelRestaurantCombinedBookingController }, reservationControllers, { runWithRequest }] = await Promise.all([
    import("../dist/controllers/combined-booking.controller.js"),
    import("../dist/controllers/reservation.controller.js"),
    import("../dist/config/supabase.js"),
]);

const hotel = (roomId = 1) => ({
    reservation_type: "HOTEL",
    room_id: roomId,
    table_id: null,
    check_in_date: "2026-12-10",
    check_out_date: "2026-12-12",
});

const restaurant = (tableId = 2) => ({
    reservation_type: "RESTAURANT",
    room_id: null,
    table_id: tableId,
    reservation_date: "2026-12-10",
    start_time: "18:00",
    end_time: "19:00",
});

const invoke = async (controller, body, params = {}) => {
    const req = { body, params, headers: { authorization: "Bearer request-token" }, auth: { user: { id: "customer-1" }, accessToken: "request-token" } };
    const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    const originalError = console.error;
    console.error = () => undefined;
    try {
        await new Promise((resolve) => runWithRequest(req, () => { controller(req, response).then(resolve); }));
    } finally {
        console.error = originalError;
    }
    return response;
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const withSuccessfulDatabase = async (action, { roomHotelId = 8, restaurantHotelId = 8, rpcError = null } = {}) => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    let nextReservationId = 100;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ table, url, method, body, headers: new Headers(init.headers) });
        if (method === "GET") {
            if (table === "reservation") return jsonResponse([]);
            if (table === "room") return jsonResponse([{ hotel_id: roomHotelId }]);
            if (table === "restaurant_table") return jsonResponse([{ restaurant_id: 9 }]);
            if (table === "restaurant") return jsonResponse([{ hotel_id: restaurantHotelId }]);
            return jsonResponse([]);
        }

        if (table === "create_combined_booking") {
            if (rpcError) return jsonResponse(rpcError, rpcError.httpStatus ?? 400);
            const reservations = body.p_reservations.map((row) => ({
                ...row,
                reservation_id: nextReservationId++,
                user_id: "customer-1",
                status: "Pending",
                combined_booking_id: 77,
            }));
            return jsonResponse({ combined_booking_id: 77, user_id: "customer-1", status: "Pending", reservations });
        }
        if (table === "notification") {
            return new Response(null, { status: 201 });
        }
        if (table === "reservation" && body && typeof body === "object") {
            return jsonResponse({ ...body, reservation_id: nextReservationId++ }, 201);
        }
        return new Response(null, { status: 201 });
    };
    try {
        return await action(calls);
    } finally {
        globalThis.fetch = originalFetch;
    }
};

const invalidGenericPayloads = [
    ["zero children", []],
    ["one child", [hotel()]],
    ["three children", [hotel(), restaurant(), hotel(3)]],
    ["two HOTEL children", [hotel(), hotel(3)]],
    ["two RESTAURANT children", [restaurant(), restaurant(4)]],
];

for (const [label, reservations] of invalidGenericPayloads) {
    test(`generic combined booking rejects ${label} with 400 before database access`, async () => {
        const originalFetch = globalThis.fetch;
        let databaseCalled = false;
        globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
        try {
            const response = await invoke(createCombinedBookingController, { user_id: "customer-1", reservations });
            assert.equal(response.statusCode, 400);
            if (label === "one child") {
                assert.equal(response.body.message, "A combined booking must contain exactly one HOTEL and one RESTAURANT reservation");
            }
            assert.equal(databaseCalled, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
}

test("combined-booking RPC maps 22023 to a message-bearing 400", async () => {
    await withSuccessfulDatabase(async () => {
        const response = await invoke(createCombinedBookingController, { user_id: "customer-1", reservations: [hotel(), restaurant()] });
        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.body, { message: "Combined booking requires exactly 1 room and 1 table" });
    }, { rpcError: { code: "22023", message: "Combined booking requires exactly 1 room and 1 table", httpStatus: 400 } });
});

test("combined-booking RPC maps 42501 to 403", async () => {
    await withSuccessfulDatabase(async () => {
        const response = await invoke(createCombinedBookingController, { user_id: "customer-1", reservations: [hotel(), restaurant()] });
        assert.equal(response.statusCode, 403);
        assert.deepEqual(response.body, { message: "Not authenticated" });
    }, { rpcError: { code: "42501", message: "Not authenticated", httpStatus: 403 } });
});

test("other combined-booking RPC errors return only a generic 500 message", async () => {
    await withSuccessfulDatabase(async () => {
        const response = await invoke(createCombinedBookingController, { user_id: "customer-1", reservations: [hotel(), restaurant()] });
        assert.equal(response.statusCode, 500);
        assert.deepEqual(response.body, { message: "Failed to create combined booking" });
    }, { rpcError: { code: "XX", message: "Sensitive database error", httpStatus: 500 } });
});

test("generic combined booking accepts exactly one HOTEL and one RESTAURANT reservation", async () => {
    await withSuccessfulDatabase(async (calls) => {
        const response = await invoke(createCombinedBookingController, {
            user_id: "customer-1",
            reservations: [restaurant(), hotel()],
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.reservations.length, 2);
        assert.deepEqual(response.body.reservations.map((row) => row.reservation_type).sort(), ["HOTEL", "RESTAURANT"]);
        const rpcCalls = calls.filter((call) => call.url.pathname.endsWith("/rpc/create_combined_booking"));
        assert.equal(rpcCalls.length, 1);
        assert.deepEqual(rpcCalls[0].body.p_reservations, [
            { reservation_type: "RESTAURANT", room_id: null, table_id: 2, check_in_date: null, check_out_date: null, reservation_date: "2026-12-10", start_time: "18:00", end_time: "19:00", special_request: null },
            { reservation_type: "HOTEL", room_id: 1, table_id: null, check_in_date: "2026-12-10", check_out_date: "2026-12-12", reservation_date: null, start_time: null, end_time: null, special_request: null },
        ]);
        const directWritesToRpcTables = calls.filter((call) => ["combined_booking", "reservation", "reservation_status_history"].includes(call.table)
            && call.url.pathname !== "/rest/v1/rpc/create_combined_booking"
            && ["POST", "PATCH", "DELETE"].includes(call.method));
        assert.deepEqual(directWritesToRpcTables, []);
        assert.match(rpcCalls[0].headers.get("authorization") ?? "", /^Bearer request-token$/);
        assert.deepEqual(calls.filter((call) => call.table === "notification" && call.method === "POST").length, 2);
        const notificationCalls = calls.filter((call) => call.table === "notification" && call.method === "POST");
        assert.ok(notificationCalls.every((call) => calls.indexOf(call) > calls.indexOf(rpcCalls[0])));
    });
});

test("combined booking rejects a restaurant without hotel_id before inserting", async () => {
    await withSuccessfulDatabase(async (calls) => {
        const response = await invoke(createCombinedBookingController, {
            user_id: "customer-1", reservations: [hotel(), restaurant()],
        });
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.message, "Room and table must belong to the same hotel");
        assert.equal(calls.some((entry) => entry.url.pathname.endsWith("/rpc/create_combined_booking")), false);
    }, { restaurantHotelId: null });
});

test("combined booking accepts a room and table in the same hotel", async () => {
    await withSuccessfulDatabase(async (calls) => {
        const response = await invoke(createCombinedBookingController, {
            user_id: "customer-1", reservations: [hotel(), restaurant()],
        });
        assert.equal(response.statusCode, 201);
        assert.equal(calls.filter((entry) => entry.url.pathname.endsWith("/rpc/create_combined_booking")).length, 1);
    });
});

test("combined booking rejects a room and table in different hotels before inserting", async () => {
    await withSuccessfulDatabase(async (calls) => {
        const response = await invoke(createCombinedBookingController, {
            user_id: "customer-1", reservations: [hotel(), restaurant()],
        });
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.message, "Room and table must belong to the same hotel");
        assert.equal(calls.some((entry) => entry.url.pathname.endsWith("/rpc/create_combined_booking")), false);
    }, { restaurantHotelId: 12 });
});

test("hotel-restaurant endpoint succeeds with one reservation of each type", async () => {
    await withSuccessfulDatabase(async (calls) => {
        const response = await invoke(createHotelRestaurantCombinedBookingController, {
            user_id: "customer-1",
            hotel_reservation: hotel(),
            restaurant_reservation: restaurant(),
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.reservations.length, 2);
        assert.deepEqual(response.body.reservations.map((row) => row.reservation_type).sort(), ["HOTEL", "RESTAURANT"]);
        assert.equal(calls.filter((entry) => entry.url.pathname.endsWith("/rpc/create_combined_booking")).length, 1);
    });
});

for (const reservation of [hotel(), restaurant()]) {
    test(`standalone ${reservation.reservation_type} reservation still succeeds`, async () => {
        await withSuccessfulDatabase(async (calls) => {
            const response = await invoke(reservationControllers.createReservationController, {
                ...reservation,
                user_id: "customer-1",
            });

            assert.equal(response.statusCode, 201);
            assert.equal(response.body.reservation_type, reservation.reservation_type);
            assert.equal(calls.filter((entry) => entry.url.pathname.endsWith("/rpc/create_combined_booking")).length, 0);
            assert.equal(calls.find((entry) => entry.table === "reservation" && entry.method === "POST")?.body.combined_booking_id, undefined);
        });
    });
}

test("POST /reservations rejects attaching a child to a combined booking", async () => {
    const originalFetch = globalThis.fetch;
    let databaseCalled = false;
    globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
    try {
        const response = await invoke(reservationControllers.createReservationController, {
            ...hotel(), user_id: "customer-1", combined_booking_id: 77,
        });
        assert.equal(response.statusCode, 400);
        assert.equal(databaseCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("PUT /reservations rejects changing combined_booking_id", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (input, init = {}) => {
        requests.push({ url: String(input), method: init.method ?? "GET" });
        return jsonResponse({
            reservation_id: 12,
            user_id: "customer-1",
            reservation_type: "HOTEL",
            room_id: 1,
            table_id: null,
            check_in_date: "2026-12-10",
            check_out_date: "2026-12-12",
            status: "Pending",
            combined_booking_id: null,
        });
    };
    try {
        const response = await invoke(reservationControllers.updateReservationController, { combined_booking_id: 77 }, { id: "12" });
        assert.equal(response.statusCode, 400);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, "GET");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("PUT /reservations cannot change a combined child's HOTEL/RESTAURANT type", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (input, init = {}) => {
        requests.push({ url: String(input), method: init.method ?? "GET" });
        return jsonResponse({
            reservation_id: 12,
            user_id: "customer-1",
            reservation_type: "HOTEL",
            room_id: 1,
            table_id: null,
            check_in_date: "2026-12-10",
            check_out_date: "2026-12-12",
            status: "Pending",
            combined_booking_id: 77,
        });
    };
    try {
        const response = await invoke(reservationControllers.updateReservationController, {
            reservation_type: "RESTAURANT",
            room_id: null,
            table_id: 9,
            reservation_date: "2026-12-10",
            start_time: "18:00",
            end_time: "19:00",
        }, { id: "12" });
        assert.equal(response.statusCode, 400);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, "GET");
    } finally {
        globalThis.fetch = originalFetch;
    }
});
