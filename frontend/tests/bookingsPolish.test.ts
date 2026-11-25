import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCombinedBookingCount } from "../src/adminBookings.ts";

test("Bookings workspace tabs use the existing active pill-tab treatment", async () => {
    const [app, css] = await Promise.all([
        readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/admin-theme.css", import.meta.url), "utf8"),
    ]);

    assert.match(app, /className="reservation-tabs" role="tablist" aria-label="Bookings workspace sections"/);
    assert.match(css, /\.admin-app \.reservation-tabs button\.active/);
});

test("Combined Bookings identifies Admin viewers as Admins", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

    assert.match(app, /<p className="eyebrow">\{isAdmin\(user\) \? "ADMIN WORKSPACE" : "STAFF WORKSPACE"\}<\/p><h1>Combined Bookings<\/h1>/);
});

test("Completed status stays on one line in the Combined Bookings table", async () => {
    const css = await readFile(new URL("../src/admin-theme.css", import.meta.url), "utf8");

    assert.match(css, /\.staff-reservations-table \.reservation-status\.completed\s*\{[^}]*white-space:\s*nowrap/s);
});

test("manager reservation cards do not offer cancellation for Completed or Cancelled", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

    assert.match(app, /manager && !\["Cancelled", "Completed"\]\.includes\(item\.status\).*className="cancel-reservation-button"/);
});

test("Combined Stays count shows loading or unavailable state before showing its count", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

    assert.match(app, /loadCombinedBookingCount\(\(\) => apiGet<CombinedBooking\[]>\("\/combined-bookings"\)\)\s*\.then\(\(\{ bookings \}\) => \{ setCombinedItems\(bookings\); setCombinedError\(""\); \}\)/);
    assert.match(app, /combinedLoading \? "…" : combinedError \? "—" : countCombinedBookings\(combinedItems\)/);
    const returnedBookings = [
        { combined_booking_id: 7 },
        { combined_booking_id: 8 },
    ];
    const loaded = await loadCombinedBookingCount(async () => returnedBookings);
    assert.equal(loaded.count, loaded.bookings.length);
    assert.equal(loaded.count, 2);
});
