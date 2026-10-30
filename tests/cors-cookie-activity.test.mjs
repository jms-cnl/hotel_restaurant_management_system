import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-publishable-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test";

const { createCorsMiddleware, parseAllowedOrigins } = await import("../dist/middleware/cors.middleware.js");
const { sessionCookieOptions } = await import("../dist/config/session-cookie.js");
const { sessionIdleTimeoutForRoleMs } = await import("../dist/services/session-policy.js");

function invokeCors(middleware, origin, method = "GET") {
    const headers = {};
    const req = { method, get(name) { return name === "Origin" ? origin : undefined; } };
    let continued = false;
    const res = {
        statusCode: 200,
        headers,
        vary(value) { headers.vary = value; return this; },
        setHeader(name, value) { headers[name] = value; return this; },
        status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; },
        sendStatus(value) { this.statusCode = value; return this; }
    };
    middleware(req, res, () => { continued = true; });
    return { req, res, continued };
}

test("CORS allows credentialed requests only from exact configured origins", () => {
    const origins = parseAllowedOrigins("https://app.example.test, http://localhost:5173");
    const cors = createCorsMiddleware(origins);
    const allowed = invokeCors(cors, "https://app.example.test");
    assert.equal(allowed.continued, true);
    assert.equal(allowed.res.headers["Access-Control-Allow-Origin"], "https://app.example.test");
    assert.equal(allowed.res.headers["Access-Control-Allow-Credentials"], "true");
    const untrusted = invokeCors(cors, "https://evil.example.test", "POST");
    assert.equal(untrusted.continued, false);
    assert.equal(untrusted.res.statusCode, 403);
});

test("CORS rejects wildcard and non-origin allowlist entries", () => {
    assert.throws(() => parseAllowedOrigins("*"), /wildcard/i);
    assert.throws(() => parseAllowedOrigins("https://app.example.test/path"), /origin/i);
});

test("credentialed CORS preflight preserves methods and permits the CSRF header", () => {
    const cors = createCorsMiddleware(parseAllowedOrigins("https://app.example.test"));
    const { res, continued } = invokeCors(cors, "https://app.example.test", "OPTIONS");
    assert.equal(continued, false);
    assert.equal(res.statusCode, 204);
    assert.match(res.headers["Access-Control-Allow-Methods"], /DELETE/);
    assert.match(res.headers["Access-Control-Allow-Headers"], /X-CSRF-Token/i);
    assert.equal(res.headers["Access-Control-Allow-Credentials"], "true");
});

test("session cookie is host-only, HttpOnly, path-rooted, and uses deployment SameSite config", () => {
    const priorMode = process.env.NODE_ENV;
    const priorSameSite = process.env.HRMS_SESSION_COOKIE_SAME_SITE;
    process.env.NODE_ENV = "production";
    process.env.HRMS_SESSION_COOKIE_SAME_SITE = "none";
    try {
        const options = sessionCookieOptions(900_000);
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, true);
        assert.equal(options.sameSite, "none");
        assert.equal(options.path, "/");
        assert.equal("domain" in options, false);
        assert.equal(options.maxAge, 900_000);
    } finally {
        if (priorMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorMode;
        if (priorSameSite === undefined) delete process.env.HRMS_SESSION_COOKIE_SAME_SITE; else process.env.HRMS_SESSION_COOKIE_SAME_SITE = priorSameSite;
    }
});

test("profile roles receive the approved idle timeouts", () => {
    assert.equal(sessionIdleTimeoutForRoleMs("Customer"), 30 * 60_000);
    assert.equal(sessionIdleTimeoutForRoleMs("Staff"), 15 * 60_000);
    assert.equal(sessionIdleTimeoutForRoleMs("Admin"), 15 * 60_000);
});
