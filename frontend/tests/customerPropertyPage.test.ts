import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("hotel property page loads existing room, restaurant, and amenity resources", async () => {
    const page = await source("../src/components/HotelDetails.tsx");

    assert.match(page, /apiGet<Room\[]>\("\/rooms"\)/);
    assert.match(page, /apiGet<Restaurant\[]>\("\/restaurants"\)/);
    assert.match(page, /apiGet<Amenity\[]>\(`/);
    assert.match(page, /className="hotel-restaurants-section"/);
    assert.match(page, /restaurants\.map\(\(restaurant\)/);
    assert.match(page, /to=\{`\/restaurants\/\$\{restaurant\.restaurant_id\}`\}/);
});

test("hotel property page keeps the hotel-load failure state", async () => {
    const page = await source("../src/components/HotelDetails.tsx");

    assert.match(page, /if \(error && !hotel\).*role="alert"/s);
});

test("hotel property page explains when Maison Valment has no restaurants", async () => {
    const page = await source("../src/components/HotelDetails.tsx");

    assert.match(page, /No restaurants are listed for Maison Valment/);
});

test("hotel property page keeps the unavailable amenities state", async () => {
    const page = await source("../src/components/HotelDetails.tsx");

    assert.match(page, /Hotel amenities are unavailable\./);
    assert.match(page, /role="status"/);
});

test("customer navigation and home search use singular establishment wording", async () => {
    const [layout, home] = await Promise.all([
        source("../src/components/CustomerLayout.tsx"),
        source("../src/components/CustomerHome.tsx"),
    ]);

    assert.match(layout, /\["Hotel & Restaurant", "\/home"\]/);
    assert.match(home, /placeholder="Search hotel or restaurant\.\.\."/);
});

test("restaurant discovery links back to the Maison Valment property page", async () => {
    const page = await source("../src/components/RestaurantDiscovery.tsx");

    assert.match(page, /apiGet<Hotel\[]>\("\/hotels"\)/);
    assert.match(page, /to=\{`\/hotels\/\$\{hotelId\}`\}/);
    assert.match(page, /Maison Valment/);
});
