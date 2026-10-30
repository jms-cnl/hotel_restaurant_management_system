import assert from "node:assert/strict";
import test from "node:test";

const { noStoreApiResponses } = await import("../dist/middleware/api-cache.middleware.js");
const { createCorsMiddleware, parseAllowedOrigins } = await import("../dist/middleware/cors.middleware.js");

function invokeApi(path, { origin, authenticated = true } = {}) {
    const headers = {};
    const req = { method: "GET", path, get(name) { return name === "Origin" ? origin : undefined; } };
    const res = {
        statusCode: 200,
        setHeader(name, value) { headers[name] = value; return this; },
        status(value) { this.statusCode = value; return this; },
        json() { return this; },
        sendStatus(value) { this.statusCode = value; return this; },
        vary() { return this; }
    };

    noStoreApiResponses(req, res, () => {
        createCorsMiddleware(parseAllowedOrigins("https://app.example.test"))(req, res, () => {
            if (!authenticated) res.status(401).json({ message: "Unauthorized" });
        });
    });

    return { headers, res };
}

test("API responses, including auth and CORS errors, are private and not stored", () => {
    const authenticated = invokeApi("/auth/session");
    assert.equal(authenticated.res.statusCode, 200);
    assert.equal(authenticated.headers["Cache-Control"], "private, no-store");

    const unauthenticated = invokeApi("/auth/session", { authenticated: false });
    assert.equal(unauthenticated.res.statusCode, 401);
    assert.equal(unauthenticated.headers["Cache-Control"], "private, no-store");

    const corsRejected = invokeApi("/auth/session", { origin: "https://evil.example.test" });
    assert.equal(corsRejected.res.statusCode, 403);
    assert.equal(corsRejected.headers["Cache-Control"], "private, no-store");
});
