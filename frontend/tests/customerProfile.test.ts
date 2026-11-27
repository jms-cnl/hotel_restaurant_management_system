import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveCustomerProfileStats } from "../src/customerProfile.ts";
import type { Reservation } from "../src/types.ts";

const reservation = (overrides: Partial<Reservation>): Reservation => ({
    reservation_id: 1,
    user_id: "customer-1",
    reservation_type: "HOTEL",
    status: "Pending",
    ...overrides,
});

test("empty reservation data produces zeroed profile statistics", () => {
    assert.deepEqual(deriveCustomerProfileStats([], 0), {
        totalBookings: 0,
        hotelBookings: 0,
        diningBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
    });
});

test("profile statistics count upcoming and completed reservations", () => {
    const reservations = [
        reservation({ reservation_id: 1, status: "Confirmed", check_in_date: "2026-12-01" }),
        reservation({ reservation_id: 2, status: "Completed", check_in_date: "2026-11-20" }),
        reservation({ reservation_id: 3, status: "Pending", check_in_date: "2026-11-20" }),
    ];

    assert.deepEqual(deriveCustomerProfileStats(reservations, 1), {
        totalBookings: 3,
        hotelBookings: 3,
        diningBookings: 0,
        upcomingBookings: 1,
        completedBookings: 1,
    });
});

test("combined child reservations count once overall and once in each matching category", () => {
    const reservations = [
        reservation({ reservation_id: 10, reservation_type: "HOTEL", combined_booking_id: 7, status: "Confirmed", check_in_date: "2026-12-03" }),
        reservation({ reservation_id: 11, reservation_type: "RESTAURANT", combined_booking_id: 7, status: "Confirmed", reservation_date: "2026-12-03" }),
        reservation({ reservation_id: 12, reservation_type: "RESTAURANT", status: "Pending", reservation_date: "2026-12-05" }),
    ];

    assert.deepEqual(deriveCustomerProfileStats(reservations, 2), {
        totalBookings: 2,
        hotelBookings: 1,
        diningBookings: 2,
        upcomingBookings: 2,
        completedBookings: 0,
    });
});

test("unavailable reservation data is distinct from an empty history", () => {
    assert.equal(deriveCustomerProfileStats(null, 0), null);
    assert.equal(deriveCustomerProfileStats([], null), null);
});

test("customer profile has tabs, booking statistics, and preserves profile APIs and manager tabs", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

    assert.match(app, /Profile Info/);
    assert.match(app, /Change Password/);
    assert.match(app, /Total Bookings/);
    assert.match(app, /Hotel Bookings/);
    assert.match(app, /Dining Reservations/);
    assert.match(app, /Unable to load booking statistics/);
    assert.match(app, /updateProfile\(form\)/);
    assert.match(app, /"\/auth\/change-password"/);
    assert.match(app, /if \(manager\) return <main className="customer-profile-page">/);
});
