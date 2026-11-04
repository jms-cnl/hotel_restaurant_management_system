import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const [restaurant, table, room, hotel] = await Promise.all([
    import("../dist/controllers/restaurant.controller.js"),
    import("../dist/controllers/table.controller.js"),
    import("../dist/controllers/room.controller.js"),
    import("../dist/controllers/hotel.controller.js"),
]);

const responseFor = () => ({
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
});

for (const [name, controller] of [
    ["restaurant", restaurant.updateRestaurantController],
    ["restaurant table", table.updateTableController],
    ["room", room.updateRoomController],
    ["hotel", hotel.updateHotelController],
]) {
    test(`${name} PUT returns 400 when the body has no valid update fields`, async () => {
        const originalFetch = globalThis.fetch;
        const originalError = console.error;
        let databaseCalled = false;
        globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
        console.error = () => undefined;
        try {
            for (const body of [{}, { unknown_field: "ignored" }]) {
                const res = responseFor();
                await controller({ body, params: { id: "7" } }, res);
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.message, "No valid fields to update");
            }
        } finally {
            globalThis.fetch = originalFetch;
            console.error = originalError;
        }
        assert.equal(databaseCalled, false);
    });
}
