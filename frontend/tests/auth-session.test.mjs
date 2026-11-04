import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const vite = await createServer({ configFile: false, root: frontendRoot, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { createAuthSessionClient } = await vite.ssrLoadModule("/src/auth-session.ts");
test.after(async () => { await vite.close(); });

const profile = { user_id: "user-1", role_id: 1, first_name: "A", last_name: "Guest", email: "guest@example.test", role: { role_name: "Customer" } };
function makeClient(overrides = {}) {
    const calls = [];
    const client = {
        async get(path) { calls.push(["get", path]); return path === "/auth/session"
            ? { profile: { role_name: "Customer" }, session: { last_activity_at: "2026-10-29T00:00:00Z" } }
            : path === "/auth/recovery/session" ? { profile: { role_name: "Staff" }, session: { last_activity_at: "2026-10-29T00:00:00Z" } }
                : profile; },
        async post(path, body) { calls.push(["post", path, body]); return { csrf_token: "csrf-only", session: { idle_expires_at: new Date(Date.now() + 60_000).toISOString() } }; },
        async bootstrap(path) { calls.push(["bootstrap", path]); return "csrf-only"; },
        setCsrf(token) { calls.push(["setCsrf", token]); },
        clearCsrf() { calls.push(["clearCsrf"]); },
        ...overrides
    };
    return { client: createAuthSessionClient(client), calls };
}

test("restores the user from backend session status and bootstraps CSRF", async () => {
    const { client, calls } = makeClient();
    const result = await client.restore();
    assert.equal(result.user, profile);
    assert.ok(result.expiresAt > Date.now());
    assert.deepEqual(calls.map((call) => call.slice(0, 2)), [["get", "/auth/session"], ["bootstrap", "/auth/csrf"], ["get", "/users/me"]]);
});

test("login and registration establish cookie sessions without persisting credentials", async () => {
    const { client, calls } = makeClient();
    const login = await client.login("guest@example.test", "password");
    assert.equal(login.user, profile);
    assert.ok(calls.some((call) => call[0] === "post" && call[1] === "/auth/login"));
    assert.ok(calls.some((call) => call[0] === "setCsrf" && call[1] === "csrf-only"));
    calls.length = 0;
    const registered = await client.register({ email: profile.email });
    assert.equal(registered.authenticated, true);
    assert.ok(calls.some((call) => call[0] === "post" && call[1] === "/auth/register"));
});

test("registration without an Auth session reports confirmation without setting a user", async () => {
    const { client } = makeClient({ async post() { return { csrf_token: null, session: null }; } });
    assert.deepEqual(await client.register({ email: profile.email }), { authenticated: false, user: null, expiresAt: null });
});

test("logout clears the in-memory CSRF token even when its request fails", async () => {
    const { client, calls } = makeClient({ async post() { throw new Error("network failure"); } });
    await assert.rejects(client.logout(), /network failure/);
    assert.deepEqual(calls, [["clearCsrf"]]);
});

test("logout treats CSRF bootstrap 401 as logged out", async () => {
    const unauthorized = Object.assign(new Error("Invalid or expired session"), { status: 401 });
    const { client, calls } = makeClient({ async post() { throw unauthorized; } });

    await assert.doesNotReject(client.logout());
    assert.deepEqual(calls, [["clearCsrf"]]);
});

test("recovery exchanges URL credentials through the backend and restricts to recovery session", async () => {
    const { client, calls } = makeClient();
    const result = await client.recover({ access_token: "link-access", refresh_token: "link-refresh" });
    assert.equal(result.profile.role_name, "Staff");
    assert.ok(calls.some((call) => call[0] === "post" && call[1] === "/auth/recovery/exchange" && call[2].refresh_token === "link-refresh"));
    assert.ok(calls.some((call) => call[0] === "get" && call[1] === "/auth/recovery/session"));
    assert.ok(calls.some((call) => call[0] === "setCsrf" && call[1] === "csrf-only"));
});
