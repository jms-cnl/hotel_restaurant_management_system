import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";

process.env.VITE_API_BASE_URL = "/api";
const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const formModule = await vite.ssrLoadModule("/src/customerSupportForm.ts");
const componentModule = await vite.ssrLoadModule("/src/components/CustomerSupportForm.tsx");
const api = await vite.ssrLoadModule("/src/api.ts");
const { createCustomerSupportFormModel, customerSupportNavigationLink } = formModule;
const { CustomerSupportForm } = componentModule;
test.after(async () => { await vite.close(); });

test("Customer receives a visible support form with required bounded fields", () => {
    const form = createCustomerSupportFormModel("Customer");
    assert.ok(form);
    assert.deepEqual(form.fields, [
        { name: "subject", label: "Subject", required: true, maxLength: 120 },
        { name: "message", label: "Message", required: true, maxLength: 5000 },
    ]);
    const markup = renderToStaticMarkup(createElement(CustomerSupportForm, { roleName: "Customer" }));
    assert.match(markup, /Contact Support/);
    assert.match(markup, /id="support-subject"[^>]*required=""[^>]*maxLength="120"/);
    assert.match(markup, /id="support-message"[^>]*required=""[^>]*maxLength="5000"/);
});

test("Customer navigation includes the Support entry point", () => {
    assert.deepEqual(customerSupportNavigationLink("Customer"), { label: "Support", path: "/support" });
});

for (const role of ["Staff", "Admin"]) {
    test(`${role} does not receive the Customer support form`, () => {
        assert.equal(createCustomerSupportFormModel(role), null);
        assert.equal(customerSupportNavigationLink(role), null);
        assert.equal(renderToStaticMarkup(createElement(CustomerSupportForm, { roleName: role })), "");
    });
}

test("empty and over-limit values produce inline validation errors", () => {
    const form = createCustomerSupportFormModel("Customer");
    assert.ok(form);
    form.setField("subject", " ");
    form.setField("message", " ");
    assert.deepEqual(form.validate(), { subject: "Subject is required", message: "Message is required" });
    form.setField("subject", "s".repeat(121));
    form.setField("message", "m".repeat(5001));
    assert.deepEqual(form.validate(), {
        subject: "Subject must be 120 characters or fewer",
        message: "Message must be 5000 characters or fewer",
    });
});

test("successful submit posts the two fields, clears the form, and shows confirmation", async () => {
    api.setCsrfToken("support-csrf-token");
    const calls: Array<{ url: string; method: string; headers: Headers; body: unknown }> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        calls.push({ url: String(url), method: String(init.method), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ support_message_id: 23 }), { status: 201, headers: { "Content-Type": "application/json" } });
    };
    const form = createCustomerSupportFormModel("Customer");
    assert.ok(form);
    form.setField("subject", "Booking question");
    form.setField("message", "Can I change my booking?");
    try { await form.submit(); }
    finally { globalThis.fetch = previousFetch; api.clearCsrfToken(); }
    assert.equal(calls[0].url, "/api/support-messages");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].headers.get("X-CSRF-Token"), "support-csrf-token");
    assert.deepEqual(calls[0].body, { subject: "Booking question", message: "Can I change my booking?" });
    assert.deepEqual(form.values, { subject: "", message: "" });
    assert.equal(form.successMessage, "Support message sent successfully.");
    assert.equal(form.errorMessage, "");
});

test("failed submit shows a generic error without exposing server details", async () => {
    api.setCsrfToken("support-csrf-token");
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "private database details" }), { status: 500 });
    const form = createCustomerSupportFormModel("Customer");
    assert.ok(form);
    form.setField("subject", "Booking question");
    form.setField("message", "Can I change my booking?");
    try { await form.submit(); }
    finally { globalThis.fetch = previousFetch; api.clearCsrfToken(); }
    assert.equal(form.errorMessage, "Unable to send your support message. Please try again.");
    assert.equal(form.successMessage, "");
    assert.equal(form.errorMessage.includes("private database details"), false);
});

test("submit remains disabled while the request is pending", async () => {
    let finish!: () => void;
    const form = createCustomerSupportFormModel("Customer", () => new Promise((resolve) => {
        finish = () => resolve({ support_message_id: 24 });
    }));
    assert.ok(form);
    form.setField("subject", "Booking question");
    form.setField("message", "Can I change my booking?");
    const pending = form.submit();
    assert.equal(form.isSubmitting, true);
    assert.equal(form.submitDisabled, true);
    finish();
    await pending;
    assert.equal(form.isSubmitting, false);
});
