import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isServiceRoleCredential, parseSessionEncryptionConfig } from "../dist/config/session-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("parses a base64 256-bit encryption key and positive key version", () => {
    const key = Buffer.alloc(32, 7);
    const result = parseSessionEncryptionConfig({
        HRMS_SESSION_ENCRYPTION_KEY: key.toString("base64"),
        HRMS_SESSION_ENCRYPTION_KEY_VERSION: "2"
    });

    assert.deepEqual(result.key, key);
    assert.equal(result.keyVersion, 2);
});

test("rejects missing, malformed, or incorrectly sized encryption keys", () => {
    assert.throws(() => parseSessionEncryptionConfig({}), /HRMS_SESSION_ENCRYPTION_KEY/);
    assert.throws(() => parseSessionEncryptionConfig({
        HRMS_SESSION_ENCRYPTION_KEY: "not-base64",
        HRMS_SESSION_ENCRYPTION_KEY_VERSION: "1"
    }), /base64-encoded 32-byte key/);
    assert.throws(() => parseSessionEncryptionConfig({
        HRMS_SESSION_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"),
        HRMS_SESSION_ENCRYPTION_KEY_VERSION: "1"
    }), /base64-encoded 32-byte key/);
});

test("requires a positive integer encryption key version", () => {
    const key = Buffer.alloc(32).toString("base64");
    for (const version of [undefined, "0", "-1", "1.5", "32768", "nope"]) {
        assert.throws(() => parseSessionEncryptionConfig({
            HRMS_SESSION_ENCRYPTION_KEY: key,
            HRMS_SESSION_ENCRYPTION_KEY_VERSION: version
        }), /HRMS_SESSION_ENCRYPTION_KEY_VERSION/);
    }
});

test("accepts service-role credentials and rejects publishable or anon credentials", () => {
    const legacyServiceRole = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
    const legacyAnon = `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;

    assert.equal(isServiceRoleCredential("sb_secret_example"), true);
    assert.equal(isServiceRoleCredential(legacyServiceRole), true);
    assert.equal(isServiceRoleCredential("sb_publishable_example"), false);
    assert.equal(isServiceRoleCredential(legacyAnon), false);
    assert.equal(isServiceRoleCredential("invalid"), false);
});

test("ordinary business-data services cannot import the session-store client", () => {
    const servicesDir = path.join(root, "src", "services");
    const forbiddenImport = /(?:from\s*["'][^"']*session-store-client|import\s*\(["'][^"']*session-store-client)/;
    const offenders = readdirSync(servicesDir)
        .filter((name) => name.endsWith(".ts") && name !== "session-store.ts")
        .filter((name) => forbiddenImport.test(readFileSync(path.join(servicesDir, name), "utf8")));

    assert.deepEqual(offenders, []);
});

test("session-store client exposes only public.hrm_sessions access", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY = "sb_secret_test-credential";

    const { sessionStoreClient } = await import("../dist/config/session-store-client.js");

    assert.equal(typeof sessionStoreClient.from, "function");
    assert.throws(() => sessionStoreClient.from("reservation"), /only public\.hrm_sessions/);
    assert.equal("auth" in sessionStoreClient, false);
    assert.equal("storage" in sessionStoreClient, false);
});
