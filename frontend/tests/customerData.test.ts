import test from "node:test";
import assert from "node:assert/strict";
import {
    filterHotels,
    filterRestaurants,
    buildCombinedBookingPayload,
    buildHotelReservationPayload,
    buildRestaurantReservationPayload,
    getAddressLocations,
    getAddressCity,
    getBudgetTier,
    filterResources,
    filterReservations,
    isVenueBookable,
    canCancelReservation,
    isUpcomingBooking,
    claimRoomMediaRefresh,
    collectionState,
    mergeRoomMedia,
    combinedVenueLabel,
    countWhenAvailable,
    refreshRoomMediaOnce,
} from "../src/customerData.ts";

test("room media refresh can be claimed only once per room", () => {
    const attempted = new Set<number>();
    assert.equal(claimRoomMediaRefresh(12, attempted), true);
    assert.equal(claimRoomMediaRefresh(12, attempted), false);
    assert.equal(claimRoomMediaRefresh(13, attempted), true);
});

test("initial room image failure refreshes only that room once", async () => {
    const attempted = new Set<number>();
    let requestedRoomId = 0;
    const media = await refreshRoomMediaOnce(12, attempted, async (roomId) => {
        requestedRoomId = roomId;
        return [{ url: "refreshed" }];
    });
    assert.equal(requestedRoomId, 12);
    assert.deepEqual(media, [{ url: "refreshed" }]);
});

test("room media refresh failure returns an empty list for the placeholder", async () => {
    const media = await refreshRoomMediaOnce(12, new Set<number>(), async () => {
        throw new Error("media fetch failed");
    });
    assert.deepEqual(media, []);
});

test("a refreshed room URL failure falls back without making a second request", async () => {
    const attempted = new Set<number>();
    let requests = 0;
    const fetchMedia = async () => { requests += 1; return [{ url: "refreshed" }]; };
    assert.deepEqual(await refreshRoomMediaOnce(12, attempted, fetchMedia), [{ url: "refreshed" }]);
    assert.deepEqual(await refreshRoomMediaOnce(12, attempted, fetchMedia), []);
    assert.equal(requests, 1);
});

test("refreshing room media replaces only that room's media entry", () => {
    const current = { 12: [{ url: "expired" }], 13: [{ url: "other-room" }] };
    assert.deepEqual(mergeRoomMedia(current, 12, [{ url: "refreshed" }]), {
        12: [{ url: "refreshed" }],
        13: [{ url: "other-room" }],
    });
});

test("reservation collection distinguishes failed loads from empty results", () => {
    assert.equal(collectionState("", 0), "empty");
    assert.equal(collectionState("Unable to load", 0), "unavailable");
    assert.equal(collectionState("Unable to load", 2), "unavailable");
    assert.equal(collectionState("", 2), "populated");
});

test("reservation statistics are unavailable when their source request fails", () => {
    assert.equal(countWhenAvailable(4, true), null);
    assert.equal(countWhenAvailable(4, false), 4);
    assert.equal(countWhenAvailable(7, false, true), null);
    assert.equal(countWhenAvailable(7, false, false), 7);
});

test("amenity response distinguishes successful empty data from a failed request", () => {
    assert.equal(collectionState("", 0), "empty");
    assert.equal(collectionState("amenity request failed", 0), "unavailable");
    assert.equal(collectionState("", 2), "populated");
});

test("combined venue labels distinguish failed lookups from intentionally missing names", () => {
    assert.equal(combinedVenueLabel(undefined, true, "Hotel stay"), "Venue details unavailable");
    assert.equal(combinedVenueLabel(undefined, false, "Hotel stay"), "Hotel stay");
    assert.equal(combinedVenueLabel("Live venue", true, "Hotel stay"), "Live venue");
});

test("city is the trimmed second-to-last address segment", () => {
    assert.equal(getAddressCity("Riego De Dios, Tanza, Cavite"), "Tanza");
    assert.equal(getAddressCity("Biga 1, Silang, Cavite"), "Silang");
});

test("addresses without a city are omitted and city options deduplicate case-insensitively", () => {
    assert.equal(getAddressCity("To be updated"), "");
    const resources = [
        { address: "Riego De Dios, Tanza, Cavite" },
        { address: "Biga 1, Silang, Cavite" },
        { address: "Main Road, TANZA, Cavite" },
        { address: "To be updated" },
    ];
    assert.deepEqual(getAddressLocations(resources), ["Tanza", "Silang"]);
    assert.deepEqual(filterRestaurants([
        { restaurant_id: 4, name: "Unknown City Bistro", address: "To be updated", status: "Active" },
    ], [], { location: "updated" }), []);
});

test("cancellation is available only to standalone Pending or Confirmed reservations", () => {
    assert.equal(canCancelReservation({ status: "Pending" }), true);
    assert.equal(canCancelReservation({ status: "Confirmed" }), true);
    assert.equal(canCancelReservation({ status: "Pending", combined_booking_id: 7 }), false);
    assert.equal(canCancelReservation({ status: "Cancelled" }), false);
    assert.equal(canCancelReservation({ status: "Completed" }), false);
    assert.equal(canCancelReservation({ status: "Rejected" }), false);
});

test("upcoming counts only Pending or Confirmed records with a future start date", () => {
    assert.equal(isUpcomingBooking("Pending", "2026-11-06", "2026-11-05"), true);
    assert.equal(isUpcomingBooking("Confirmed", "2026-11-05", "2026-11-05"), false);
    assert.equal(isUpcomingBooking("Cancelled", "2026-11-06", "2026-11-05"), false);
});

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
        { restaurant_id: 2, name: "City Bistro", address: "Manila, Philippines", status: "Active" },
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
    assert.deepEqual(buildHotelReservationPayload(7, "2026-11-01", "2026-11-03", "Late arrival"), {
        reservation_type: "HOTEL",
        room_id: 7,
        check_in_date: "2026-11-01",
        check_out_date: "2026-11-03",
        special_request: "Late arrival",
    });
});

test("buildRestaurantReservationPayload matches the backend contract", () => {
    assert.deepEqual(buildRestaurantReservationPayload(9, "2026-11-01", "18:00", "19:30", "Window seating"), {
        reservation_type: "RESTAURANT",
        table_id: 9,
        reservation_date: "2026-11-01",
        start_time: "18:00",
        end_time: "19:30",
        special_request: "Window seating",
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

