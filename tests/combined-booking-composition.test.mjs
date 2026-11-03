import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [{ createCombinedBookingController, createHotelRestaurantCombinedBookingController }, reservationControllers] = await Promise.all([
    import("../dist/controllers/combined-booking.controller.js"),
    import("../dist/controllers/reservation.controller.js"),
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
    const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    const originalError = console.error;
    console.error = () => undefined;
    try {
        await controller({ body, params, auth: { user: { id: "customer-1" } } }, response);
    } finally {
        console.error = originalError;
    }
    return response;
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const withSuccessfulDatabase = async (action) => {
    const originalFetch = globalThis.fetch;
    const insertBodies = [];
    let nextReservationId = 100;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        if (method === "GET") return jsonResponse([]);

        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        insertBodies.push({ table, body });
        if (table === "combined_booking") {
            return jsonResponse({ combined_booking_id: 77, user_id: "customer-1", status: "Pending" }, 201);
        }
        if (table === "reservation" && Array.isArray(body)) {
            return jsonResponse(body.map((row) => ({ ...row, reservation_id: nextReservationId++ })), 201);
        }
        if (table === "reservation" && body && typeof body === "object") {
            return jsonResponse({ ...body, reservation_id: nextReservationId++ }, 201);
        }
        return new Response(null, { status: 201 });
    };
    try {
        return await action(insertBodies);
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
            assert.equal(databaseCalled, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
}

test("generic combined booking accepts exactly one HOTEL and one RESTAURANT reservation", async () => {
    await withSuccessfulDatabase(async (insertBodies) => {
        const response = await invoke(createCombinedBookingController, {
            user_id: "customer-1",
            reservations: [restaurant(), hotel()],
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.reservations.length, 2);
        assert.deepEqual(response.body.reservations.map((row) => row.reservation_type).sort(), ["HOTEL", "RESTAURANT"]);
        assert.equal(insertBodies.find((entry) => entry.table === "combined_booking")?.table, "combined_booking");
    });
});

test("hotel-restaurant endpoint succeeds with one reservation of each type", async () => {
    await withSuccessfulDatabase(async (insertBodies) => {
        const response = await invoke(createHotelRestaurantCombinedBookingController, {
            user_id: "customer-1",
            hotel_reservation: hotel(),
            restaurant_reservation: restaurant(),
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.reservations.length, 2);
        assert.deepEqual(response.body.reservations.map((row) => row.reservation_type).sort(), ["HOTEL", "RESTAURANT"]);
        assert.equal(insertBodies.filter((entry) => entry.table === "combined_booking").length, 1);
    });
});

for (const reservation of [hotel(), restaurant()]) {
    test(`standalone ${reservation.reservation_type} reservation still succeeds`, async () => {
        await withSuccessfulDatabase(async (insertBodies) => {
            const response = await invoke(reservationControllers.createReservationController, {
                ...reservation,
                user_id: "customer-1",
            });

            assert.equal(response.statusCode, 201);
            assert.equal(response.body.reservation_type, reservation.reservation_type);
            assert.equal(insertBodies.filter((entry) => entry.table === "combined_booking").length, 0);
            assert.equal(insertBodies.find((entry) => entry.table === "reservation")?.body.combined_booking_id, undefined);
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
