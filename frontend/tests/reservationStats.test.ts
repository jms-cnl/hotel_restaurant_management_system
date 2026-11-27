import assert from "node:assert/strict";
import test from "node:test";
import { getTodayInManila, countUpcomingBookings } from "../src/reservationStats.ts";
import type { CombinedBooking, Reservation } from "../src/types.ts";

const reservation = (overrides: Partial<Reservation>): Reservation => ({
    reservation_id: 1,
    user_id: "customer-1",
    reservation_type: "HOTEL",
    status: "Pending",
    ...overrides,
});

const combined = (overrides: Partial<CombinedBooking>): CombinedBooking => ({
    combined_booking_id: 5,
    user_id: "customer-1",
    status: "Pending",
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
});

test("today is included and past reservation dates are excluded", () => {
    const reservations = [
        reservation({ reservation_id: 1, reservation_type: "HOTEL", check_in_date: "2026-11-27" }),
        reservation({ reservation_id: 2, reservation_type: "RESTAURANT", reservation_date: "2026-11-26" }),
    ];
    assert.equal(countUpcomingBookings(reservations, [], "2026-11-27"), 1);
});

test("Manila today follows the Manila calendar across a UTC date boundary", () => {
    assert.equal(getTodayInManila(new Date("2026-11-27T17:00:00.000Z")), "2026-11-28");
});

test("Pending and Confirmed statuses are matched case-insensitively", () => {
    const reservations = [
        reservation({ reservation_id: 1, status: "pending", check_in_date: "2026-11-27" }),
        reservation({ reservation_id: 2, status: "cOnFiRmEd", reservation_type: "RESTAURANT", reservation_date: "2026-11-28" }),
    ];
    assert.equal(countUpcomingBookings(reservations, [], "2026-11-27"), 2);
});

test("Completed and Cancelled reservations are excluded", () => {
    const reservations = [
        reservation({ reservation_id: 1, status: "Completed", check_in_date: "2026-11-28" }),
        reservation({ reservation_id: 2, status: "cANCELLED", check_in_date: "2026-11-28" }),
    ];
    assert.equal(countUpcomingBookings(reservations, [], "2026-11-27"), 0);
});

test("combined bookings use parent status and count once without counting children separately", () => {
    const children = [
        reservation({ reservation_id: 11, reservation_type: "HOTEL", combined_booking_id: 5, status: "Cancelled", check_in_date: "2026-11-27" }),
        reservation({ reservation_id: 12, reservation_type: "RESTAURANT", combined_booking_id: 5, status: "Cancelled", reservation_date: "2026-11-28" }),
    ];
    const bookings = [combined({ reservation: children })];
    assert.equal(countUpcomingBookings(children, bookings, "2026-11-27"), 1);
    assert.equal(countUpcomingBookings(children, [combined({ status: "Cancelled", reservation: children })], "2026-11-27"), 0);
});

test("a combined booking qualifies when only its dining child date is today or later", () => {
    const children = [
        reservation({ reservation_id: 11, reservation_type: "HOTEL", combined_booking_id: 5, check_in_date: "2026-11-26" }),
        reservation({ reservation_id: 12, reservation_type: "RESTAURANT", combined_booking_id: 5, reservation_date: "2026-11-27" }),
    ];
    assert.equal(countUpcomingBookings([], [combined({ reservation: children })], "2026-11-27"), 1);
});
