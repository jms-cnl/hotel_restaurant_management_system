import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const inventory = await vite.ssrLoadModule("/src/staffInventory.ts");
const { formatStaffInventoryValue, loadStaffAmenities, staffInventoryFieldLabel } = inventory;
const amenityView = await vite.ssrLoadModule("/src/components/InventoryAmenityDetails.tsx");
test.after(async () => { await vite.close(); });

test("Staff inventory renders capacity and grace period with the required labels", () => {
    assert.equal(staffInventoryFieldLabel("capacity"), "No. of pax");
    assert.equal(staffInventoryFieldLabel("grace_period_minutes"), "Grace period");
    assert.equal(formatStaffInventoryValue("capacity", 4), "4");
    assert.equal(formatStaffInventoryValue("grace_period_minutes", 30), "30 min");
    assert.equal(formatStaffInventoryValue("grace_period_minutes", null), "—");
});

test("Staff can load room and table amenities on demand", async () => {
    const requests: string[] = [];
    const dependencies = {
        getRoomAmenities: async (path: string) => { requests.push(path); return [{ amenity_id: 1, name: "Wi-Fi" }]; },
        getTableAmenities: async (id: number) => { requests.push(`/tables/${id}/amenities`); return [{ amenity_id: 2, name: "Patio" }]; },
    };
    const room = await loadStaffAmenities("rooms", 5, dependencies);
    const table = await loadStaffAmenities("tables", 8, dependencies);
    assert.deepEqual(requests, ["/rooms/5/amenities", "/tables/8/amenities"]);
    assert.deepEqual(room.amenities.map((amenity: { name: string }) => amenity.name), ["Wi-Fi"]);
    assert.deepEqual(table.amenities.map((amenity: { name: string }) => amenity.name), ["Patio"]);
});

test("empty amenities remain a successful empty result and table assignment 403 is friendly", async () => {
    const empty = await loadStaffAmenities("rooms", 5, {
        getRoomAmenities: async () => [], getTableAmenities: async () => [],
    });
    const forbidden = await loadStaffAmenities("tables", 8, {
        getRoomAmenities: async () => [],
        getTableAmenities: async () => { throw Object.assign(new Error("Not assigned"), { status: 403 }); },
    });
    assert.deepEqual(empty.amenities, []);
    assert.equal(empty.error, "");
    assert.equal(forbidden.error, "These table amenities are only available to assigned staff.");
});

test("unexpected amenity failures show a safe message", async () => {
    const result = await loadStaffAmenities("rooms", 5, {
        getRoomAmenities: async () => { throw new Error("private backend details"); },
        getTableAmenities: async () => [],
    });
    assert.equal(result.error, "Unable to load amenities. Please try again.");
});

test("amenity details render loading, names, empty, and error states accessibly", () => {
    const render = (state: object) => renderToStaticMarkup(createElement(amenityView.InventoryAmenityDetails, { state }));
    assert.match(render({ loading: true, amenities: [], error: "" }), /role="status"[^>]*>Loading amenities/);
    assert.match(render({ loading: false, amenities: [{ amenity_id: 1, name: "Wi-Fi" }], error: "" }), /Wi-Fi/);
    assert.match(render({ loading: false, amenities: [], error: "" }), /No amenities/);
    assert.match(render({ loading: false, amenities: [], error: "These table amenities are only available to assigned staff." }), /role="alert"[^>]*>These table amenities are only available to assigned staff/);
});

test("Staff page exposes on-demand details while mutation controls remain Admin-only", async () => {
    const [app, styles] = await Promise.all([
        readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
    ]);
    assert.match(app, /rooms: \{ title: "Rooms"[\s\S]*?"capacity", "grace_period_minutes"/);
    assert.match(app, /tables: \{ title: "Tables"[\s\S]*?"capacity", "grace_period_minutes"/);
    assert.match(app, /onClick=\{\(\) => void toggleAmenities\(item\)\}/);
    assert.match(app, /\{amenityState && <InventoryAmenityDetails state=\{amenityState\} \/>\}/);
    assert.match(app, /const manager = isAdmin\(user\)/);
    assert.match(app, /\{manager && <form className="form-panel inline-form"/);
    assert.match(styles, /\.table-wrap \{ overflow-x: auto/);
    assert.match(styles, /\.manager-app \.table-wrap,[\s\S]*?color: #1f2937/);
});
