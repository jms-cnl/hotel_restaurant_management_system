import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { createReservationNotification } = await import("../dist/services/notification.service.js");
const { InAppNotificationChannel, NotificationChannelCreator } = await import("../dist/services/notification-channel.js");
const { runWithRequest } = await import("../dist/config/supabase.js");

const notification = {
    userId: "customer-7",
    reservationId: 42,
    type: "RESERVATION_CREATED",
};

const withDatabase = async (fetcher, action) => {
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const logs = [];
    globalThis.fetch = fetcher;
    console.error = (...args) => logs.push(args);
    try {
        await new Promise((resolve, reject) => runWithRequest(
            { auth: { user: { id: "customer-7" }, accessToken: "request-token" } },
            () => Promise.resolve(action()).then(resolve, reject),
        ));
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
    }
    return logs;
};

test("creator workflow delivers through its created channel", async () => {
    const delivered = [];
    class RecordingCreator extends NotificationChannelCreator {
        createChannel() {
            return { async deliver(message) { delivered.push(message); } };
        }
    }

    const result = await new RecordingCreator().deliver(notification);

    assert.equal(result, undefined);
    assert.deepEqual(delivered, [notification]);
});

test("reservation notification persists the existing in-app payload", async () => {
    let request;
    const logs = await withDatabase(async (input, init = {}) => {
        request = { url: new URL(String(input)), method: init.method, body: JSON.parse(init.body) };
        return new Response(null, { status: 201 });
    }, () => createReservationNotification(notification));

    assert.equal(request.url.pathname, "/rest/v1/notification");
    assert.equal(request.method, "POST");
    assert.deepEqual(request.body, {
        user_id: "customer-7",
        reservation_id: 42,
        title: "Reservation created",
        message: "Your reservation has been created and is pending confirmation.",
        type: "RESERVATION_CREATED",
        is_read: false,
    });
    assert.deepEqual(logs, []);
});

test("reservation notification logs and swallows a database insert error", async () => {
    let requestUrl;
    const logs = await withDatabase(async (input, init = {}) => {
        requestUrl = new URL(String(input));
        assert.equal(init.method, "POST");
        return new Response(JSON.stringify({ code: "42501" }), { status: 403 });
    }, async () => {
        await assert.doesNotReject(createReservationNotification(notification));
    });

    assert.equal(requestUrl.pathname, "/rest/v1/notification");
    assert.deepEqual(logs, [["Reservation notification creation failed", { reservationId: 42, type: "RESERVATION_CREATED", errorCode: "42501" }]]);
});

test("reservation notification logs and swallows a thrown persistence failure", async () => {
    const originalError = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args);
    try {
        const channel = new InAppNotificationChannel(async () => { throw new Error("database unavailable"); });
        await assert.doesNotReject(channel.deliver({
            ...notification,
            title: "Reservation created",
            message: "Your reservation has been created and is pending confirmation.",
        }));
    } finally {
        console.error = originalError;
    }

    assert.deepEqual(logs, [["Reservation notification creation failed", { reservationId: 42, type: "RESERVATION_CREATED" }]]);
});
