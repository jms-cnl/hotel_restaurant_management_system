import test from "node:test";
import assert from "node:assert/strict";
import {
    filterHotels,
    filterRestaurants,
    buildCombinedBookingPayload,
    buildHotelReservationPayload,
    buildRestaurantReservationPayload,
    getAddressLocations,
    getBudgetTier,
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

test("budget tiers use the lowest available nightly room rate", () => {
    assert.equal(getBudgetTier(2500), "budget-friendly");
    assert.equal(getBudgetTier(2500.01), "moderate");
    assert.equal(getBudgetTier(5000), "moderate");
    assert.equal(getBudgetTier(5000.01), "premium");
});

test("hotel filters use address, available room rates, and room availability", () => {
    const hotels = [
        { hotel_id: 1, name: "Garden Hotel", address: "Silang, Cavite", status: "Active" },
        { hotel_id: 2, name: "City Hotel", address: "Manila", status: "Active" },
        { hotel_id: 3, name: "Inactive Hotel", address: "Silang, Cavite", status: "Inactive" },
    ];
    const rooms = [
        { room_id: 11, hotel_id: 1, price_per_night: 2500, status: "Available" },
        { room_id: 12, hotel_id: 1, price_per_night: 1800, status: "Reserved" },
        { room_id: 21, hotel_id: 2, price_per_night: 5200, status: "Available" },
        { room_id: 31, hotel_id: 3, price_per_night: 1900, status: "Available" },
    ];

    assert.deepEqual(filterHotels(hotels, rooms, { location: "Silang", budgetTier: "budget-friendly", availability: "available" }), [hotels[0]]);
    assert.deepEqual(filterHotels(hotels, rooms, { availability: "unavailable" }), [hotels[2]]);
});

test("restaurant filters use address and available tables without a budget field", () => {
    const restaurants = [
        { restaurant_id: 1, name: "Garden Table", address: "Tagaytay, Cavite", status: "Active" },
        { restaurant_id: 2, name: "City Bistro", address: "Manila", status: "Active" },
    ];
    const tables = [
        { table_id: 11, restaurant_id: 1, status: "Available" },
        { table_id: 21, restaurant_id: 2, status: "Reserved" },
    ];

    assert.deepEqual(filterRestaurants(restaurants, tables, { location: "Tagaytay", availability: "available" }), [restaurants[0]]);
    assert.deepEqual(getAddressLocations(restaurants), ["Tagaytay", "Manila"]);
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

