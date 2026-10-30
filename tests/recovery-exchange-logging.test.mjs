import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-publishable-key";
process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-session-store";
process.env.HRMS_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION = "1";

const { recoveryExchangeController } = await import("../dist/controllers/auth.controller.js");

test("recovery exchange logs an amr rejection without logging token values", async () => {
    const payload = Buffer.from(JSON.stringify({ amr: [{ method: "otp" }] })).toString("base64url");
    const accessToken = `header.${payload}.signature`;
    const refreshToken = "refresh-token-secret";
    const logs = [];
    const originalError = console.error;
    const response = {};
    const res = {
        status(code) { response.status = code; return this; },
        json(body) { response.body = body; return this; }
    };
    console.error = (...args) => logs.push(args);
    try {
        await recoveryExchangeController({ body: { access_token: accessToken, refresh_token: refreshToken } }, res);
    } finally {
        console.error = originalError;
    }

    assert.deepEqual(response, { status: 401, body: { message: "Recovery link is invalid or expired" } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "[recovery-exchange] failed");
    assert.deepEqual(logs[0][1], { stage: "amr_check", detail: ["otp"] });
    assert.equal(JSON.stringify(logs).includes(accessToken), false);
    assert.equal(JSON.stringify(logs).includes(refreshToken), false);
});

test("unexpected recovery exchange errors log only the error name", async () => {
    const logs = [];
    const originalError = console.error;
    const response = {};
    const res = {
        status(code) { response.status = code; return this; },
        json(body) { response.body = body; return this; }
    };
    console.error = (...args) => logs.push(args);
    try {
        await recoveryExchangeController({ get body() { throw new Error("sensitive-message-value"); } }, res);
    } finally {
        console.error = originalError;
    }

    assert.deepEqual(response, { status: 401, body: { message: "Recovery link is invalid or expired" } });
    assert.deepEqual(logs, [["[recovery-exchange] failed", { stage: "unknown", errorName: "Error" }]]);
    assert.equal(JSON.stringify(logs).includes("sensitive-message-value"), false);
});
