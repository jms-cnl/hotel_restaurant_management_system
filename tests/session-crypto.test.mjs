import assert from "node:assert/strict";
import test from "node:test";
import {
    decryptSessionCredentials,
    encryptSessionCredentials
} from "../dist/services/session-crypto.js";

const key = Buffer.alloc(32, 11);
const config = { key, keyVersion: 7 };
const credentials = { accessToken: "access-secret", refreshToken: "refresh-secret" };
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";

test("encrypts and decrypts credentials using AES-256-GCM with versioned metadata", () => {
    const encrypted = encryptSessionCredentials(sessionId, userId, credentials, config);

    assert.equal(encrypted.nonce.length, 12);
    assert.equal(encrypted.authTag.length, 16);
    assert.equal(encrypted.keyVersion, 7);
    assert.deepEqual(decryptSessionCredentials(sessionId, userId, encrypted, config), credentials);
});

test("binds ciphertext to both session and user IDs", () => {
    const encrypted = encryptSessionCredentials(sessionId, userId, credentials, config);

    assert.throws(() => decryptSessionCredentials(sessionId, "123e4567-e89b-42d3-a456-426614174002", encrypted, config), /authentication/i);
    assert.throws(() => decryptSessionCredentials("123e4567-e89b-42d3-a456-426614174003", userId, encrypted, config), /authentication/i);
});

test("rejects corrupted ciphertext, nonce, tag, and unsupported key version", () => {
    const encrypted = encryptSessionCredentials(sessionId, userId, credentials, config);
    const tampered = { ...encrypted, ciphertext: Buffer.from(encrypted.ciphertext) };
    tampered.ciphertext[0] ^= 1;
    assert.throws(() => decryptSessionCredentials(sessionId, userId, tampered, config), /authentication/i);
    assert.throws(() => decryptSessionCredentials(sessionId, userId, { ...encrypted, nonce: Buffer.alloc(11) }, config), /nonce/i);
    assert.throws(() => decryptSessionCredentials(sessionId, userId, { ...encrypted, authTag: Buffer.alloc(15) }, config), /authentication tag/i);
    assert.throws(() => decryptSessionCredentials(sessionId, userId, { ...encrypted, keyVersion: 8 }, config), /key version/i);
});

test("rejects invalid key lengths, versions, identifiers, and credential payloads", () => {
    assert.throws(() => encryptSessionCredentials(sessionId, userId, credentials, { key: Buffer.alloc(16), keyVersion: 1 }), /32 bytes/);
    assert.throws(() => encryptSessionCredentials(sessionId, userId, credentials, { key, keyVersion: 0 }), /key version/i);
    assert.throws(() => encryptSessionCredentials("bad-id", userId, credentials, config), /session ID/i);
    assert.throws(() => encryptSessionCredentials(sessionId, userId, { accessToken: "", refreshToken: "r" }, config), /credentials/i);
});
