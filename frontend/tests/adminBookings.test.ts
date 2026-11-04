import assert from "node:assert/strict";
import test from "node:test";
import { dashboardReservationReportPath, displayGuestCount, formatOccupancyRate } from "../src/adminBookings.ts";

test("dashboard reservation reports use first and last day of the current month", () => {
    const now = new Date("2026-11-05T08:00:00.000Z");

    assert.equal(
        dashboardReservationReportPath("HOTEL", now),
        "/reports/reservations?type=HOTEL&date_from=2026-11-01&date_to=2026-11-30"
    );
    assert.equal(
        dashboardReservationReportPath("RESTAURANT", now),
        "/reports/reservations?type=RESTAURANT&date_from=2026-11-01&date_to=2026-11-30"
    );
});

test("dashboard reservation report date range handles leap February", () => {
    assert.equal(
        dashboardReservationReportPath("HOTEL", new Date("2024-02-15T12:00:00.000Z")),
        "/reports/reservations?type=HOTEL&date_from=2024-02-01&date_to=2024-02-29"
    );
});

test("guest counts render as unavailable because the API has no guest-count field", () => {
    assert.equal(displayGuestCount(undefined), "—");
});

test("occupancy report fractions render to one decimal place like the design card", () => {
    assert.equal(formatOccupancyRate(0.625), "62.5%");
    assert.equal(formatOccupancyRate(0.5), "50%");
});
