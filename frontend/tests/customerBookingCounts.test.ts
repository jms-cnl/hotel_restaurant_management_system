import assert from "node:assert/strict";
import test from "node:test";
import { countCustomerBookingStats } from "../src/reservationStats.ts";
import type { CombinedBooking, Reservation } from "../src/types.ts";

const reservation = (overrides: Partial<Reservation>): Reservation => ({
    reservation_id: 1,
    user_id: "customer-1",
    reservation_type: "HOTEL",
    status: "Pending",
    ...overrides,
});

const combinedBooking = (id: number, children: Reservation[]): CombinedBooking => ({
    combined_booking_id: id,
    user_id: "customer-1",
    status: "Confirmed",
    created_at: "2026-11-01T00:00:00Z",
    reservation: children,
});

test("combined children do not inflate hotel or dining while Total counts each combined booking once", () => {
    const children = [1, 2, 3].flatMap((id) => [
        reservation({ reservation_id: id * 10, reservation_type: "HOTEL", combined_booking_id: id }),
        reservation({ reservation_id: id * 10 + 1, reservation_type: "RESTAURANT", combined_booking_id: id }),
    ]);
    const reservations = [
        ...children,
        reservation({ reservation_id: 99, reservation_type: "RESTAURANT" }),
    ];
    const bookings = [1, 2, 3].map((id) => combinedBooking(id, children.filter((child) => child.combined_booking_id === id)));

    assert.deepEqual(countCustomerBookingStats(reservations, bookings), {
        hotelBookings: 0,
        diningBookings: 1,
        combinedBookings: 3,
        totalBookings: 4,
    });
});

test("mixed standalone reservations and combined bookings produce the shared counts", () => {
    const combinedHotel = reservation({ reservation_id: 3, reservation_type: "HOTEL", combined_booking_id: 7 });
    const combinedDining = reservation({ reservation_id: 4, reservation_type: "RESTAURANT", combined_booking_id: 7 });

    assert.deepEqual(countCustomerBookingStats([
        reservation({ reservation_id: 1, reservation_type: "HOTEL" }),
        reservation({ reservation_id: 2, reservation_type: "RESTAURANT" }),
        combinedHotel,
        combinedDining,
    ], [combinedBooking(7, [combinedHotel, combinedDining])]), {
        hotelBookings: 1,
        diningBookings: 1,
        combinedBookings: 1,
        totalBookings: 3,
    });
});

test("a combined booking with multiple children contributes one Total booking", () => {
    const hotel = reservation({ reservation_id: 10, reservation_type: "HOTEL", combined_booking_id: 5 });
    const dining = reservation({ reservation_id: 11, reservation_type: "RESTAURANT", combined_booking_id: 5 });

    assert.equal(countCustomerBookingStats([hotel, dining], [combinedBooking(5, [hotel, dining])]).totalBookings, 1);
});

test("empty reservation and combined booking lists produce zero counts", () => {
    assert.deepEqual(countCustomerBookingStats([], []), {
        hotelBookings: 0,
        diningBookings: 0,
        combinedBookings: 0,
        totalBookings: 0,
    });
});
