import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";

process.env.VITE_API_BASE_URL = "/api";
const vite = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, ".."), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const inboxModule = await vite.ssrLoadModule("/src/adminSupportInbox.ts");
const componentModule = await vite.ssrLoadModule("/src/components/AdminSupportInbox.tsx");
const { createAdminSupportInboxModel, adminSupportNavigationLink, supportInboxRedirectForRole } = inboxModule;
const { AdminSupportInbox } = componentModule;
test.after(async () => { await vite.close(); });

const messages = [
    { support_message_id: 8, customer_id: "customer-8", subject: "Refund question", message: "Please check my refund.", status: "open", created_at: "2026-11-25T08:30:00.000Z" },
    { support_message_id: 7, customer_id: "customer-7", subject: "Booking change", message: "I need to change dates.", status: "resolved", created_at: "2026-11-24T08:30:00.000Z" },
];

test("Admin can load and see the support inbox list", async () => {
    const calls: string[] = [];
    const inbox = createAdminSupportInboxModel("Admin", async path => { calls.push(path); return messages; });
    assert.ok(inbox);
    await inbox.load();
    assert.deepEqual(calls, ["/support-messages"]);
    const markup = renderToStaticMarkup(createElement(AdminSupportInbox, { model: inbox }));
    assert.match(markup, /Refund question/);
    assert.match(markup, /customer-8/);
    assert.match(markup, /open/);
    assert.match(markup, /Booking change/);
    assert.match(markup, /2026/);
});

test("Customer and Staff are redirected away from the support inbox", () => {
    for (const role of ["Customer", "Staff"]) {
        assert.equal(createAdminSupportInboxModel(role, async () => messages), null);
        assert.equal(supportInboxRedirectForRole(role), "/home");
    }
    assert.equal(supportInboxRedirectForRole("Admin"), null);
});

test("Admin navigation includes Support", () => {
    assert.deepEqual(adminSupportNavigationLink("Admin"), { label: "Support", path: "/support-inbox" });
    assert.equal(adminSupportNavigationLink("Staff"), null);
});

test("status filter shows only matching support messages and empty state", async () => {
    const inbox = createAdminSupportInboxModel("Admin", async () => messages);
    assert.ok(inbox);
    await inbox.load();
    inbox.setStatusFilter("resolved");
    assert.deepEqual(inbox.filteredMessages.map((message: typeof messages[number]) => message.support_message_id), [7]);
    inbox.setStatusFilter("open");
    assert.deepEqual(inbox.filteredMessages.map((message: typeof messages[number]) => message.support_message_id), [8]);
    inbox.setStatusFilter("resolved");
    inbox.setMessages([]);
    assert.equal(inbox.emptyMessage, "No support messages found.");
});

test("selected support message detail shows its full subject, message, customer, status and date", async () => {
    const inbox = createAdminSupportInboxModel("Admin", async path => path === "/support-messages" ? messages : messages[0]);
    assert.ok(inbox);
    await inbox.load();
    await inbox.selectMessage(8);
    const markup = renderToStaticMarkup(createElement(AdminSupportInbox, { model: inbox }));
    assert.match(markup, /Refund question/);
    assert.match(markup, /Please check my refund\./);
    assert.match(markup, /customer-8/);
    assert.match(markup, /open/);
    assert.match(markup, /November|2026/);
});

test("resolving an open message sends PATCH and updates selected detail and list status", async () => {
    const calls: Array<{ path: string; status: string }> = [];
    const inbox = createAdminSupportInboxModel("Admin", async (path, status) => {
        if (status) calls.push({ path, status });
        return status ? { ...messages[0], status } : messages;
    });
    assert.ok(inbox);
    await inbox.load();
    await inbox.selectMessage(8);
    await inbox.changeStatus();
    assert.deepEqual(calls, [{ path: "/support-messages/8/status", status: "resolved" }]);
    assert.equal(inbox.selectedMessage.status, "resolved");
    assert.equal(inbox.messages[0].status, "resolved");
});

test("reopening a resolved message sends PATCH and updates selected detail and list status", async () => {
    const calls: Array<{ path: string; status: string }> = [];
    const inbox = createAdminSupportInboxModel("Admin", async (path, status) => {
        if (status) calls.push({ path, status });
        return status ? { ...messages[1], status } : messages;
    });
    assert.ok(inbox);
    await inbox.load();
    await inbox.selectMessage(7);
    await inbox.changeStatus();
    assert.deepEqual(calls, [{ path: "/support-messages/7/status", status: "open" }]);
    assert.equal(inbox.selectedMessage.status, "open");
    assert.equal(inbox.messages[1].status, "open");
});

test("failed status update shows a generic error and leaves status unchanged", async () => {
    const inbox = createAdminSupportInboxModel("Admin", async (path, status) => {
        if (status) throw new Error("private backend details");
        return messages;
    });
    assert.ok(inbox);
    await inbox.load();
    await inbox.selectMessage(8);
    await inbox.changeStatus();
    assert.equal(inbox.errorMessage, "Unable to update support message. Please try again.");
    assert.equal(inbox.errorMessage.includes("private backend details"), false);
    assert.equal(inbox.selectedMessage.status, "open");
});

test("status action is disabled while a request is pending", async () => {
    let finish!: (message: typeof messages[number]) => void;
    const inbox = createAdminSupportInboxModel("Admin", async (_path, status) => status
        ? new Promise(resolve => { finish = resolve; })
        : messages);
    assert.ok(inbox);
    await inbox.load();
    await inbox.selectMessage(8);
    const pending = inbox.changeStatus();
    assert.equal(inbox.isPending, true);
    assert.equal(inbox.actionDisabled, true);
    finish({ ...messages[0], status: "resolved" });
    await pending;
    assert.equal(inbox.isPending, false);
});
