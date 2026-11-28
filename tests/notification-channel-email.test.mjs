import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { EmailNotificationCreator } = await import("../dist/services/notification-channel.js");

const cases = [
    {
        notification: { type: "RESERVATION_CREATED", to: "guest@example.test", bookingId: 103 },
        expected: {
            to: "guest@example.test",
            subject: "Reservation 103 received",
            text: "Your reservation 103 has been created.",
            html: "<p>Your reservation 103 has been created.</p>",
        },
    },
    {
        notification: { type: "RESERVATION_STATUS_CHANGED", to: "guest@example.test", bookingId: 103, status: "confirmed" },
        expected: {
            to: "guest@example.test",
            subject: "Reservation 103 confirmed",
            text: "The status of reservation 103 is now confirmed.",
            html: "<p>The status of reservation 103 is now confirmed.</p>",
        },
    },
    {
        notification: { type: "COMBINED_BOOKING_CONFIRMED", to: "guest@example.test", bookingId: 71 },
        expected: {
            to: "guest@example.test",
            subject: "Combined booking 71 confirmed",
            text: "Your combined booking 71 is confirmed.",
            html: "<p>Your combined booking 71 is confirmed.</p>",
        },
    },
    {
        notification: { type: "SUPPORT_MESSAGE_RESOLVED", to: "guest@example.test", supportMessageId: 42 },
        expected: {
            to: "guest@example.test",
            subject: "Support message 42 resolved",
            text: "Your support message 42 has been resolved.",
            html: "<p>Your support message 42 has been resolved.</p>",
        },
    },
];

test("email creator delivers each notification through its configured sender and template", async () => {
    const sent = [];
    const sender = { async send(message) { sent.push(message); return { providerMessageId: "provider-123" }; } };
    const creator = new EmailNotificationCreator(sender);

    for (const { notification, expected } of cases) {
        const result = await creator.deliver(notification);
        assert.deepEqual(sent.at(-1), expected);
        assert.deepEqual(result, { providerMessageId: "provider-123" });
    }

    assert.equal(sent.length, cases.length);
});

test("email creator preserves sender failures", async () => {
    const failure = new Error("provider unavailable");
    const creator = new EmailNotificationCreator({ async send() { throw failure; } });

    await assert.rejects(creator.deliver(cases[0].notification), error => error === failure);
});
