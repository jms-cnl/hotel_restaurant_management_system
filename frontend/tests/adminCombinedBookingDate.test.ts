import assert from "node:assert/strict";
import test from "node:test";
import { formatAdminCombinedBookingDateTime } from "../src/bookingTime.ts";

test("Admin combined booking date display preserves the date and strips time seconds", () => {
    assert.equal(
        formatAdminCombinedBookingDateTime("2026-11-27", "14:00:00", "15:30:00"),
        "2026-11-27 14:00–15:30",
    );
});

test("Admin combined booking date display handles missing and invalid times", () => {
    assert.equal(formatAdminCombinedBookingDateTime("2026-11-27", undefined, undefined), "2026-11-27 —");
    assert.equal(formatAdminCombinedBookingDateTime("2026-11-27", "not-a-time", "25:00:00"), "2026-11-27 —");
});
