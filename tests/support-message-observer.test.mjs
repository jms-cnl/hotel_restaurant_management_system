import assert from "node:assert/strict";
import test from "node:test";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";
const [{ SupportMessageSubject, SupportMessageHistoryObserver, AdminInboxNotificationObserver }, serviceModule, { runWithRequest }] = await Promise.all([
    import("../dist/services/support-message-observer.js"),
    import("../dist/services/support-message.service.js"),
    import("../dist/config/supabase.js"),
]);
const message = { supportMessageId: 23, actorId: "user-123" };
const event = (type, extra = {}) => ({ type, ...message, ...extra });
const jsonResponse = (body, status = 200, contentType = "application/json") => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
});
const withFetch = async (handler, run) => {
    const calls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = String(init.method ?? "GET").toUpperCase();
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method, body });
        return handler({ url, method, body, calls });
    };
    try { return { result: await run(), calls }; }
    finally { globalThis.fetch = previousFetch; }
};
const makeRequest = (userId = "user-123") => ({ headers: { authorization: "Bearer support-test-access-token" }, auth: { user: { id: userId }, accessToken: "support-test-access-token" } });
const runInRequest = (req, operation) => new Promise((resolve, reject) => {
    runWithRequest(req, () => Promise.resolve(operation()).then(resolve, reject));
});
test("subject notifies attached observers and stops notifying detached observers", () => {
    const subject = new SupportMessageSubject();
    const calls = [];
    const first = { update: (value) => calls.push(["first", value]) };
    const second = { update: (value) => calls.push(["second", value]) };
    subject.attach(first);
    subject.attach(second);
    subject.detach(first);
    const submitted = event("submitted", { newStatus: "open" });
    subject.notify(submitted);
    assert.deepEqual(calls, [["second", submitted]]);
});
test("history observer records submitted event after message creation", async () => {
    const observer = new SupportMessageHistoryObserver(makeRequest());
    const { calls } = await withFetch(({ url, method }) => {
        assert.equal(url.pathname, "/rest/v1/support_message_history");
        assert.equal(method, "POST");
        return jsonResponse([] , 201);
    }, () => runInRequest(makeRequest(), () => observer.update(event("submitted", { newStatus: "open" }))));
    assert.deepEqual(calls[0].body, {
        support_message_id: 23,
        actor_user_id: "user-123",
        event_type: "submitted",
        previous_status: null,
        new_status: "open",
    });
});
test("history observer records Admin status changes", async () => {
    const observer = new SupportMessageHistoryObserver(makeRequest("admin-1"));
    const { calls } = await withFetch(({ url, method }) => {
        assert.equal(url.pathname, "/rest/v1/support_message_history");
        assert.equal(method, "POST");
        return jsonResponse([], 201);
    }, () => runInRequest(makeRequest("admin-1"), () => observer.update(event("status_changed", {
        actorId: "admin-1", previousStatus: "open", newStatus: "resolved",
    }))));
    assert.deepEqual(calls[0].body, {
        support_message_id: 23,
        actor_user_id: "admin-1",
        event_type: "status_changed",
        previous_status: "open",
        new_status: "resolved",
    });
});
test("notification observer leaves submitted notifications to the database trigger", async () => {
    const observer = new AdminInboxNotificationObserver(makeRequest());
    const { calls } = await withFetch(() => { throw new Error("submitted must not write notifications"); },
        () => runInRequest(makeRequest(), () => observer.update(event("submitted", { newStatus: "open" }))));
    assert.deepEqual(calls, []);
});
for (const [newStatus, previousStatus] of [["resolved", "open"], ["open", "resolved"]]) {
    test(`notification observer updates all rows when status changes to ${newStatus}`, async () => {
        const observer = new AdminInboxNotificationObserver(makeRequest("admin-1"));
        const { calls } = await withFetch(({ url, method }) => {
            assert.equal(url.pathname, "/rest/v1/support_message_admin_notification");
            assert.equal(method, "PATCH");
            assert.equal(url.searchParams.get("support_message_id"), "eq.23");
            return new Response(null, { status: 204 });
        }, () => runInRequest(makeRequest("admin-1"), () => observer.update(event("status_changed", {
            actorId: "admin-1", previousStatus, newStatus,
        }))));
        if (newStatus === "open") assert.deepEqual(calls[0].body, { handled_at: null });
        else assert.ok(Number.isFinite(Date.parse(calls[0].body.handled_at)));
    });
}
test("submit service notifies history observer after insert and does not insert notifications", async () => {
    const req = makeRequest();
    const { calls } = await withFetch(({ url, method }) => {
        if (url.pathname === "/auth/v1/user") return jsonResponse({ id: "user-123" });
        if (url.pathname === "/rest/v1/user") return jsonResponse({ user_id: "user-123", role_id: 1, role: { role_name: "Customer" } }, 200, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message" && method === "POST") return jsonResponse({ support_message_id: 23, customer_id: "user-123", subject: "Help", message: "Need help", status: "open" }, 201, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message_history" && method === "POST") return jsonResponse([], 201);
        throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    }, () => runInRequest(req, () => serviceModule.createSupportMessage(req, { subject: "Help", message: "Need help" })));
    assert.equal(calls.findIndex((call) => call.url.pathname === "/rest/v1/support_message") < calls.findIndex((call) => call.url.pathname === "/rest/v1/support_message_history"), true);
    assert.equal(calls.some((call) => call.url.pathname === "/rest/v1/support_message_admin_notification"), false);
});
test("status service notifies history and updates notification handling", async () => {
    const req = makeRequest("admin-1");
    const { calls } = await withFetch(({ url, method }) => {
        if (url.pathname === "/auth/v1/user") return jsonResponse({ id: "admin-1" });
        if (url.pathname === "/rest/v1/user") return jsonResponse({ user_id: "admin-1", role_id: 3, role: { role_name: "Admin" } }, 200, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message" && method === "GET") return jsonResponse({ support_message_id: 23, customer_id: "user-123", status: "open" }, 200, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message" && method === "PATCH") return jsonResponse({ support_message_id: 23, customer_id: "user-123", status: "resolved" }, 200, "application/vnd.pgrst.object+json");
        if (url.pathname === "/rest/v1/support_message_history" && method === "POST") return jsonResponse([], 201);
        if (url.pathname === "/rest/v1/support_message_admin_notification" && method === "PATCH") return new Response(null, { status: 204 });
        throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    }, () => runInRequest(req, () => serviceModule.updateSupportMessageStatus(req, "23", "resolved")));
    assert.ok(calls.some((call) => call.url.pathname === "/rest/v1/support_message_history" && call.method === "POST"));
    assert.ok(calls.some((call) => call.url.pathname === "/rest/v1/support_message_admin_notification" && call.method === "PATCH"));
});
