import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { createRestaurantController, updateRestaurantController } = await import("../dist/controllers/restaurant.controller.js");

const invoke = async (controller, body, params = {}) => {
    const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
    const originalError = console.error;
    console.error = () => undefined;
    try {
        await controller({ body, params }, response);
    } finally {
        console.error = originalError;
    }
    return response;
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

const restaurantPayload = {
    name: "Cafe",
    address: "Main street",
    contact_number: "123456",
    status: "Active",
};

test("restaurant creation assigns the only hotel when hotel_id is omitted", async () => {
    const originalFetch = globalThis.fetch;
    let insertedRestaurant;
    globalThis.fetch = async (input, init = {}) => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        const method = (init.method ?? "GET").toUpperCase();
        if (table === "hotel" && method === "GET") return jsonResponse([{ hotel_id: 8 }]);
        if (table === "restaurant" && method === "POST") {
            insertedRestaurant = JSON.parse(String(init.body));
            return jsonResponse({ restaurant_id: 20, ...insertedRestaurant }, 201);
        }
        throw new Error(`Unexpected ${method} ${table}`);
    };
    try {
        const response = await invoke(createRestaurantController, restaurantPayload);
        assert.equal(response.statusCode, 201);
        assert.equal(insertedRestaurant.hotel_id, 8);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("restaurant creation rejects a nonexistent hotel_id with 400", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        if (table === "hotel") return jsonResponse([]);
        throw new Error(`Unexpected ${init.method ?? "GET"} ${table}`);
    };
    try {
        const response = await invoke(createRestaurantController, { ...restaurantPayload, hotel_id: 999 });
        assert.equal(response.statusCode, 400);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

for (const hotelId of [null, "abc"]) {
    test(`restaurant creation rejects hotel_id ${JSON.stringify(hotelId)} before database access`, async () => {
        const originalFetch = globalThis.fetch;
        let databaseCalled = false;
        globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
        try {
            const response = await invoke(createRestaurantController, { ...restaurantPayload, hotel_id: hotelId });
            assert.equal(response.statusCode, 400);
            assert.equal(response.body.message, "hotel_id must be a positive integer");
            assert.equal(databaseCalled, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
}

test("restaurant update rejects a hotel_id change with 400 before database access", async () => {
    const originalFetch = globalThis.fetch;
    let databaseCalled = false;
    globalThis.fetch = async () => { databaseCalled = true; throw new Error("Unexpected database call"); };
    try {
        const response = await invoke(updateRestaurantController, { hotel_id: 8 }, { id: "20" });
        assert.equal(response.statusCode, 400);
        assert.equal(databaseCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("restaurant create and update 500 responses omit the error field", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonResponse({ message: "Database failure", code: "XX" }, 500);
    const originalError = console.error;
    console.error = () => undefined;
    try {
        const createResponse = await invoke(createRestaurantController, restaurantPayload);
        const updateResponse = await invoke(updateRestaurantController, { name: "Updated" }, { id: "20" });
        assert.equal(createResponse.statusCode, 500);
        assert.deepEqual(createResponse.body, { message: "Failed to create restaurant" });
        assert.equal(updateResponse.statusCode, 500);
        assert.deepEqual(updateResponse.body, { message: "Failed to update restaurant" });
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
    }
});
