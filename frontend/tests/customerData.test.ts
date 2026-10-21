import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCombinedBookingPayload,
    buildHotelReservationPayload,
    buildRestaurantReservationPayload,
    filterResources,
    filterReservations,
    isVenueBookable,
} from "../src/customerData.ts";

test("filterResources searches names and addresses and applies status", () => {
    const resources = [
        { name: "Garden Hotel", address: "Silang, Cavite", status: "Active" },
        { name: "City Hotel", address: "Manila", status: "Inactive" },
    ];

    assert.deepEqual(filterResources(resources, "cavite", "all"), [resources[0]]);
    assert.deepEqual(filterResources(resources, "hotel", "Inactive"), [resources[1]]);
    assert.deepEqual(filterResources(resources, "missing", "all"), []);
});

test("only active venues can be booked", () => {
    assert.equal(isVenueBookable("Active"), true);
    assert.equal(isVenueBookable("active"), true);
    assert.equal(isVenueBookable("Inactive"), false);
    assert.equal(isVenueBookable(undefined), false);
});

test("buildHotelReservationPayload matches the backend contract", () => {
    assert.deepEqual(buildHotelReservationPayload(7, "2026-11-01", "2026-11-03"), {
        reservation_type: "HOTEL",
        room_id: 7,
        check_in_date: "2026-11-01",
        check_out_date: "2026-11-03",
    });
});

test("buildRestaurantReservationPayload matches the backend contract", () => {
    assert.deepEqual(buildRestaurantReservationPayload(9, "2026-11-01", "18:00", "19:30"), {
        reservation_type: "RESTAURANT",
        table_id: 9,
        reservation_date: "2026-11-01",
        start_time: "18:00",
        end_time: "19:30",
    });
});

test("buildCombinedBookingPayload nests hotel and restaurant reservations", () => {
    assert.deepEqual(buildCombinedBookingPayload({ roomId: 7, checkIn: "2026-11-01", checkOut: "2026-11-03", tableId: 9, date: "2026-11-01", startTime: "18:00", endTime: "19:30" }), {
        hotel_reservation: { room_id: 7, check_in_date: "2026-11-01", check_out_date: "2026-11-03" },
        restaurant_reservation: { table_id: 9, reservation_date: "2026-11-01", start_time: "18:00", end_time: "19:30" },
    });
});

test("filterReservations applies category and status filters", () => {
    const reservations = [
        { reservation_type: "HOTEL", status: "Pending" },
        { reservation_type: "RESTAURANT", status: "Confirmed" },
    ];

    assert.deepEqual(filterReservations(reservations, "HOTEL", "all"), [reservations[0]]);
    assert.deepEqual(filterReservations(reservations, "all", "Confirmed"), [reservations[1]]);
});

