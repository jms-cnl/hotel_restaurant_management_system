import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("customer home presents one hotel and removes the multi-hotel directory and location filter", async () => {
    const home = await source("../src/components/CustomerHome.tsx");

    assert.doesNotMatch(home, /Explore Places to Stay/);
    assert.doesNotMatch(home, /Location<select|\[location, setLocation\]|getAddressLocations|\n\s*location,/);
});

test("hotel catalog routes to the sole hotel detail instead of rendering a hotel list", async () => {
    const discovery = await source("../src/components/HotelDiscovery.tsx");

    assert.match(discovery, /Navigate|useNavigate/);
    assert.match(discovery, /\/hotels\/\$\{[^}]+hotel_id[^}]*\}/);
    assert.doesNotMatch(discovery, /HOTEL DIRECTORY|visibleHotels\.length === 1/);
    assert.doesNotMatch(discovery, /Location<select|\[location, setLocation\]|getAddressLocations/);
});

test("restaurant discovery removes its location filter and directory framing", async () => {
    const discovery = await source("../src/components/RestaurantDiscovery.tsx");

    assert.doesNotMatch(discovery, /RESTAURANT DIRECTORY|Location<select|\[location, setLocation\]|getAddressLocations/);
    assert.match(discovery, /Availability<select/);
    assert.match(discovery, /Search restaurants/);
});

test("customer catalog routes remain behind the existing Protected boundary", async () => {
    const app = await source("../src/App.tsx");

    assert.match(app, /<Route path="\*" element=\{<Protected><AppLayout>/);
    assert.match(app, /<Route path="\/hotels" element=\{<StaffPropertyRedirect><HotelCatalogRoute \/><\/StaffPropertyRedirect>\}/);
});
