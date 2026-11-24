import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminTabs } from "../src/adminTabs.ts";

test("Admin navigation has one Bookings tab in place of Manage, Reservations, and Combined Bookings", () => {
    const bookingTabs = adminTabs.filter(tab => ["/bookings", "/manage", "/reservations", "/combined-bookings"].includes(tab.path));

    assert.equal(bookingTabs.length, 1);
    assert.equal(bookingTabs[0].label, "Bookings");
    assert.equal(bookingTabs[0].path, "/bookings");
});

test("Bookings workspace keeps existing reservation actions, details, and history screens reachable", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

    assert.match(app, /function AdminBookingsWorkspace/);
    assert.match(app, /<AdminManage\s*\/>/);
    assert.match(app, /<Reservations\s*\/>/);
    assert.match(app, /<CombinedBookings\s*\/>/);
    assert.match(app, /\/reservations\/\$\{item\.reservation_id\}\/history/);
    assert.match(app, /\/combined-bookings\/\$\{item\.combined_booking_id\}\/status/);
    assert.match(app, /\/reservations\/\$\{item\.reservation_id\}\/status/);
});

test("Admin Cancelled booking status retains its pill styling", async () => {
    const adminCss = await readFile(new URL("../src/admin-theme.css", import.meta.url), "utf8");
    assert.match(adminCss, /\.admin-crud-status\.cancelled/);
});
