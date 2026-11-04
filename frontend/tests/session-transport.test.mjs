import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

process.env.VITE_API_BASE_URL = "/api";
const frontendRoot = path.resolve(import.meta.dirname, "..");
const vite = await createServer({ configFile: false, root: frontendRoot, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const api = await vite.ssrLoadModule("/src/api.ts");

test.after(async () => { await vite.close(); });

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("API accepts an empty 204 logout response without parsing JSON", async () => {
    api.setCsrfToken("csrf-test-token");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 204 });
    try { assert.equal(await api.apiPost("/auth/logout", {}), null); }
    finally { globalThis.fetch = originalFetch; api.clearCsrfToken(); }
});

test("API sends credentialed requests and adds CSRF only to state-changing API calls", async () => {
    api.clearCsrfToken();
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
        calls.push({ url: String(url), init });
        return calls.length === 1 ? jsonResponse({ csrf_token: "csrf-test-token" }) : jsonResponse({ ok: true });
    };
    try { await api.apiPost("/reservations", { room_id: 1 }); }
    finally { globalThis.fetch = originalFetch; }
    assert.equal(calls[0].url, "/api/auth/csrf");
    assert.equal(calls[0].init.credentials, "include");
    assert.equal(calls[1].init.credentials, "include");
    assert.equal(new Headers(calls[1].init.headers).get("X-CSRF-Token"), "csrf-test-token");
    assert.equal(new Headers(calls[1].init.headers).get("Authorization"), null);
});

test("API refreshes the CSRF token once after the backend rejects an expired token", async () => {
    api.clearCsrfToken();
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
        const headers = new Headers(init.headers);
        calls.push({ url: String(url), csrf: headers.get("X-CSRF-Token") });
        if (calls.length === 1) return jsonResponse({ csrf_token: "csrf-old" });
        if (calls.length === 2) return jsonResponse({ message: "Invalid or missing CSRF token" }, 403);
        if (calls.length === 3) return jsonResponse({ csrf_token: "csrf-new" });
        return jsonResponse({ ok: true });
    };
    try { await api.apiPatch("/profile", {}); }
    finally { globalThis.fetch = originalFetch; }
    assert.deepEqual(calls.map((call) => call.url), ["/api/auth/csrf", "/api/profile", "/api/auth/csrf", "/api/profile"]);
    assert.equal(calls[1].csrf, "csrf-old");
    assert.equal(calls[3].csrf, "csrf-new");
});

test("logout CSRF bootstrap 401 stops before sending logout", async () => {
    api.clearCsrfToken();
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        return jsonResponse({ message: "Invalid or expired session" }, 401);
    };
    try {
        await assert.rejects(api.apiPost("/auth/logout", {}), (error) => error.status === 401);
    } finally {
        globalThis.fetch = originalFetch;
        api.clearCsrfToken();
    }
    assert.deepEqual(calls, ["/api/auth/csrf"]);
});

test("recovery requests re-bootstrap CSRF through the restricted recovery endpoint", async () => {
    api.clearCsrfToken();
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
        calls.push(String(url));
        if (calls.length === 1) return jsonResponse({ csrf_token: "recovery-csrf-old" });
        if (calls.length === 2) return jsonResponse({ message: "Invalid or missing CSRF token" }, 403);
        if (calls.length === 3) return jsonResponse({ csrf_token: "recovery-csrf-new" });
        return jsonResponse({ message: "Password reset successfully" });
    };
    try { await api.apiPost("/auth/reset-password", { new_password: "new-password" }); }
    finally { globalThis.fetch = originalFetch; api.clearCsrfToken(); }
    assert.deepEqual(calls, ["/api/auth/recovery/csrf", "/api/auth/reset-password", "/api/auth/recovery/csrf", "/api/auth/reset-password"]);
});

test("meaningful activity reports only on an explicit call and refreshes the in-memory CSRF token", async () => {
    api.clearCsrfToken();
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, init = {}) => {
        request = { url: String(url), init };
        return jsonResponse({ csrf_token: "rotated-csrf" });
    };
    try { await api.reportMeaningfulActivity(); }
    finally { globalThis.fetch = originalFetch; }
    assert.equal(request.url, "/api/auth/csrf");
    assert.equal(request.init.credentials, "include");
    assert.equal(new Headers(request.init.headers).get("X-CSRF-Token"), null);
    assert.equal(api.getCsrfToken(), "rotated-csrf");
});

test("frontend auth code does not persist or send bearer tokens", async () => {
    const [apiSource, authSource, appSource, authSessionSource] = await Promise.all([
        readFile(path.join(frontendRoot, "src/api.ts"), "utf8"),
        readFile(path.join(frontendRoot, "src/auth.tsx"), "utf8"),
        readFile(path.join(frontendRoot, "src/App.tsx"), "utf8"),
        readFile(path.join(frontendRoot, "src/auth-session.ts"), "utf8")
    ]);
    assert.doesNotMatch(apiSource, /localStorage|Bearer\s/);
    assert.doesNotMatch(authSource, /localStorage|access_token|refresh_token|Bearer\s/);
    assert.doesNotMatch(authSessionSource, /localStorage|sessionStorage|Bearer\s/);
    assert.doesNotMatch(appSource, /setToken|localStorage/);
    assert.match(authSessionSource, /recovery\/exchange/);
    assert.match(appSource, /authSession\.recover/);
    assert.match(authSource, /authSession\.restore/);
    assert.match(appSource, /two minutes/);
});
