import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const pages = await vite.ssrLoadModule("/src/components/BookingDisplayPages.tsx");
test.after(async () => { await vite.close(); });

test("report requests include active filters and omit empty filters", () => {
    assert.equal(pages.reportRequestPath("reservations", {
        date_from: "2026-11-01",
        date_to: "",
        status: "Confirmed",
        type: "",
        hotel_id: "8",
        restaurant_id: "",
        room_id: "",
        table_id: "",
    }), "/reports/reservations?date_from=2026-11-01&status=Confirmed&hotel_id=8");
});

test("empty row data is reported only for table-style report types", () => {
    assert.equal(pages.reportHasNoRows("reservations", { reservations: [] }), true);
    assert.equal(pages.reportHasNoRows("revenue", { reservations: [] }), true);
    assert.equal(pages.reportHasNoRows("tables", { reservations: [] }), true);
    assert.equal(pages.reportHasNoRows("occupancy", { reservations: [] }), false);
    assert.equal(pages.reportHasNoRows("reservations", { reservations: [{ reservation_id: 1 }] }), false);
    assert.equal(pages.reportHasNoRows("reservations", null), false);
});
