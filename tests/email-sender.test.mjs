import assert from "node:assert/strict";
import test from "node:test";
import {
    BrevoEmailSender,
    BrevoEmailError,
    ConsoleEmailSender,
    NoopEmailSender,
    createEmailSender,
} from "../dist/services/email-sender.js";
import {
    reservationCreatedTemplate,
    reservationStatusChangedTemplate,
    combinedBookingConfirmedTemplate,
    supportMessageResolvedTemplate,
} from "../dist/services/email-templates.js";

const mail = {
    to: "guest@example.com",
    subject: "Reservation created",
    text: "Your reservation was created.",
    html: "<p>Your reservation was created.</p>",
};

test("Brevo adapter maps a message to the HTTP API and returns its provider ID", async () => {
    let request;
    const sender = new BrevoEmailSender({
        apiKey: "brevo-secret",
        from: "verified@example.com",
        fromName: "Hotel",
        replyTo: "help@example.com",
        fetcher: async (url, options) => {
            request = { url, options, body: JSON.parse(options.body) };
            return new Response(JSON.stringify({ messageId: "<provider-123>" }), { status: 201 });
        },
    });

    const result = await sender.send(mail);

    assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["api-key"], "brevo-secret");
    assert.equal(request.options.headers["Content-Type"], "application/json");
    assert.deepEqual(request.body, {
        sender: { email: "verified@example.com", name: "Hotel" },
        to: [{ email: "guest@example.com" }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
        replyTo: { email: "help@example.com" },
    });
    assert.deepEqual(result, { providerMessageId: "<provider-123>" });
});

test("Brevo adapter omits optional reply-to and supplies its default sender name", async () => {
    let payload;
    const sender = new BrevoEmailSender({
        apiKey: "key",
        from: "verified@example.com",
        fetcher: async (_url, options) => {
            payload = JSON.parse(options.body);
            return new Response("{}", { status: 200 });
        },
    });

    const result = await sender.send(mail);

    assert.deepEqual(payload.sender, { email: "verified@example.com", name: "HRMS" });
    assert.equal("replyTo" in payload, false);
    assert.deepEqual(result, {});
});

test("Brevo adapter reports an HTTP failure without exposing its API key", async () => {
    const secret = "sensitive-brevo-key";
    const sender = new BrevoEmailSender({
        apiKey: secret,
        from: "verified@example.com",
        fetcher: async () => new Response("unauthorized", { status: 401 }),
    });

    await assert.rejects(sender.send(mail), (error) => {
        assert.ok(error instanceof BrevoEmailError);
        assert.match(error.message, /401/);
        assert.equal(error.message.includes(secret), false);
        return true;
    });
});

test("provider factory defaults to console and selects console or noop explicitly", async () => {
    const previousLog = console.info;
    const logs = [];
    console.info = (...args) => logs.push(args.join(" "));
    try {
        const defaultSender = createEmailSender({});
        assert.ok(defaultSender instanceof ConsoleEmailSender);
        await defaultSender.send(mail);
        assert.match(logs[0], /Reservation created/);
        assert.match(logs[0], /g\*\*\*@example.com/);
        assert.equal(logs[0].includes(mail.to), false);
        assert.ok(createEmailSender({ EMAIL_PROVIDER: "console" }) instanceof ConsoleEmailSender);

        const noop = createEmailSender({ EMAIL_PROVIDER: "noop" });
        assert.ok(noop instanceof NoopEmailSender);
        await noop.send(mail);
        assert.deepEqual(noop.messages, [mail]);
    } finally {
        console.info = previousLog;
    }
});

test("provider factory requires Brevo credentials and a verified sender address", () => {
    assert.throws(() => createEmailSender({ EMAIL_PROVIDER: "brevo", EMAIL_FROM: "verified@example.com" }), /BREVO_API_KEY/);
    assert.throws(() => createEmailSender({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "key" }), /EMAIL_FROM/);
    assert.throws(() => createEmailSender({ EMAIL_PROVIDER: "smtp" }), /EMAIL_PROVIDER/);
});

test("provider factory configures a Brevo sender from environment values", () => {
    const sender = createEmailSender({
        EMAIL_PROVIDER: "brevo",
        BREVO_API_KEY: "key",
        EMAIL_FROM: "verified@example.com",
        EMAIL_FROM_NAME: "Hotel",
        EMAIL_REPLY_TO: "help@example.com",
    });

    assert.ok(sender instanceof BrevoEmailSender);
});

test("reservation templates include booking ID and changed status in customer content", () => {
    const created = reservationCreatedTemplate({ bookingId: "RES-103" });
    const status = reservationStatusChangedTemplate({ bookingId: "RES-103", status: "cancelled" });

    assert.match(created.subject, /RES-103/);
    assert.match(created.text, /RES-103/);
    assert.match(status.subject, /cancelled/i);
    assert.match(status.text, /RES-103/);
    assert.match(status.text, /cancelled/i);
});

test("combined booking and resolved support templates identify their records", () => {
    const combined = combinedBookingConfirmedTemplate({ bookingId: 71 });
    const support = supportMessageResolvedTemplate({ supportMessageId: 42 });

    assert.match(combined.text, /71/);
    assert.match(combined.html, /71/);
    assert.match(support.text, /42/);
    assert.match(support.subject, /resolved/i);
});
