import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const kindsModule = await vite.ssrLoadModule("/src/adminInventoryKinds.ts");
const { createInventoryResourceRegistry, getInventoryResourceKind, inventoryResourceKinds } = kindsModule;
test.after(async () => { await vite.close(); });

const expectedKinds = [
    {
        kind: "hotels", label: "Hotels", singular: "Hotel", endpoint: "/hotels", idField: "hotel_id", mediaEntityType: "hotel", summaryStatus: "Active",
        columns: ["name:Hotel Name", "address:Address", "description:Description", "contact_number:Contact Number", "email:Email", "status:Status"],
    },
    {
        kind: "restaurants", label: "Restaurants", singular: "Restaurant", endpoint: "/restaurants", idField: "restaurant_id", mediaEntityType: "restaurant", summaryStatus: "Active",
        columns: ["name:Restaurant Name", "address:Address", "description:Description", "contact_number:Contact Number", "email:Email", "status:Status"],
    },
    {
        kind: "rooms", label: "Rooms", singular: "Room", endpoint: "/rooms", idField: "room_id", mediaEntityType: "room", summaryStatus: "Available",
        columns: ["hotel_id:Hotel ID", "room_number:Room Number", "room_type:Room Type", "capacity:Capacity", "price_per_night:Price per Night (₱)", "status:Room Status"],
    },
    {
        kind: "tables", label: "Tables", singular: "Table", endpoint: "/tables", idField: "table_id", mediaEntityType: "table", summaryStatus: "Available",
        columns: ["restaurant_id:Restaurant ID", "table_number:Table Number", "capacity:Seating Capacity", "status:Table Status"],
    },
];

test("each inventory kind exposes its columns, fields, labels, paths, and summary status", () => {
    for (const expected of expectedKinds) {
        const kind = getInventoryResourceKind(expected.kind);
        assert.ok(kind, `${expected.kind} is registered`);
        assert.equal(kind.label, expected.label);
        assert.equal(kind.singular, expected.singular);
        assert.equal(kind.endpoint, expected.endpoint);
        assert.equal(kind.idField, expected.idField);
        assert.equal(kind.mediaEntityType, expected.mediaEntityType);
        assert.equal(kind.summaryStatus, expected.summaryStatus);
        assert.deepEqual(kind.columns.map((field) => `${field.key}:${field.label}`), expected.columns);
        assert.deepEqual(kind.fields, kind.columns);
    }
});

test("hotel and restaurant fields keep their required and optional form behavior", () => {
    for (const name of ["hotels", "restaurants"]) {
        const kind = getInventoryResourceKind(name)!;
        assert.equal(kind.fields.find((field) => field.key === "name")?.required, true);
        assert.equal(kind.fields.find((field) => field.key === "description")?.required, undefined);
        assert.equal(kind.fields.find((field) => field.key === "email")?.type, "email");
        assert.deepEqual(kind.statusOptions, ["Active", "Inactive", "Suspended"]);
        assert.equal(kind.defaultStatus, "Active");
    }
});

test("room and table fields keep their numeric constraints, choices, and status behavior", () => {
    const rooms = getInventoryResourceKind("rooms")!;
    const tables = getInventoryResourceKind("tables")!;
    assert.equal(rooms.fields.find((field) => field.key === "hotel_id")?.min, 1);
    assert.deepEqual(rooms.fields.find((field) => field.key === "room_type")?.options, ["Standard Room", "Deluxe Room", "Family Room", "Suite"]);
    assert.equal(rooms.fields.find((field) => field.key === "price_per_night")?.min, 0);
    assert.equal(tables.fields.find((field) => field.key === "capacity")?.min, 1);
    assert.deepEqual(rooms.statusOptions, ["Available", "Reserved", "Occupied", "Maintenance"]);
    assert.equal(tables.defaultStatus, "Available");
});

test("room and restaurant kind strategies preserve their amenity paths and form rules", () => {
    const rooms = getInventoryResourceKind("rooms")!;
    const restaurants = getInventoryResourceKind("restaurants")!;
    assert.equal(rooms.supportsAmenities, true);
    assert.equal(rooms.getAmenityHotelId("create", { hotel_id: "12" }), "12");
    assert.equal(rooms.getAmenitiesPath({ room_id: 4 }), "/rooms/4/amenities");
    assert.equal(rooms.shouldShowAmenitiesForm("create"), true);
    assert.equal(rooms.shouldRequireAmenitiesLoaded("create"), true);
    assert.equal(rooms.amenitiesLabel, "Room Amenities");
    assert.equal(rooms.amenitySubject, "room");
    assert.equal(restaurants.supportsAmenities, true);
    assert.equal(restaurants.getAmenityHotelId("edit", {}, { hotel_id: 12 }), "12");
    assert.equal(restaurants.getAmenitiesPath({ restaurant_id: 8 }), "/restaurants/8/amenities");
    assert.equal(restaurants.shouldShowAmenitiesForm("create"), false);
    assert.equal(restaurants.shouldShowAmenitiesForm("edit"), true);
    assert.equal(restaurants.shouldRequireAmenitiesLoaded("create"), false);
    assert.equal(restaurants.shouldRequireAmenitiesLoaded("edit"), true);
    assert.equal(restaurants.amenitiesLabel, "Restaurant Amenities");
    assert.equal(restaurants.amenitySubject, "restaurant");
});

test("amenity-free kinds keep their existing capabilities and are independent of the page", () => {
    for (const name of ["hotels", "tables"]) {
        const kind = getInventoryResourceKind(name)!;
        assert.equal(kind.supportsAmenities, false);
        assert.equal(kind.shouldShowAmenitiesForm("create"), false);
        assert.equal(kind.shouldRequireAmenitiesLoaded("edit"), false);
    }
});

test("a new kind can be registered and retrieved without page-specific branching", () => {
    const addedKind = { ...getInventoryResourceKind("hotels")!, kind: "spas", label: "Spas" };
    const registry = createInventoryResourceRegistry([...inventoryResourceKinds.values(), addedKind]);
    assert.equal(registry.get("spas"), addedKind);
});

test("unknown kinds remain absent from the registry", () => {
    assert.equal(getInventoryResourceKind("unknown"), undefined);
});
