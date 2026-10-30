import {
    createHash,
    createCipheriv,
    createDecipheriv,
    randomBytes,
    timingSafeEqual
} from "node:crypto";
import type { SessionEncryptionConfig } from "../config/session-config.js";
import { parseSessionEncryptionConfig } from "../config/session-config.js";

export type SessionCredentials = {
    accessToken: string;
    refreshToken: string;
};

export type EncryptedSessionCredentials = {
    ciphertext: Buffer;
    nonce: Buffer;
    authTag: Buffer;
    keyVersion: number;
};

const base64UrlSecretPattern = /^[A-Za-z0-9_-]{43}$/;

export const verifySessionCsrfToken = (storedHash: Uint8Array, suppliedToken: string): boolean => {
    if (storedHash.byteLength !== 32 || !base64UrlSecretPattern.test(suppliedToken)) return false;
    const tokenBytes = Buffer.from(suppliedToken, "base64url");
    if (tokenBytes.length !== 32 || tokenBytes.toString("base64url") !== suppliedToken) return false;
    const suppliedHash = createHash("sha256").update(tokenBytes).digest();
    return timingSafeEqual(Buffer.from(storedHash), suppliedHash);
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateContext = (sessionId: string, userId: string) => {
    if (!uuidPattern.test(sessionId)) throw new Error("Invalid session ID for credential encryption");
    if (!uuidPattern.test(userId)) throw new Error("Invalid user ID for credential encryption");
};

const validateConfig = (config: SessionEncryptionConfig) => {
    if (!Buffer.isBuffer(config.key) || config.key.length !== 32) {
        throw new Error("Session encryption key must be exactly 32 bytes");
    }
    if (!Number.isInteger(config.keyVersion) || config.keyVersion < 1 || config.keyVersion > 32767) {
        throw new Error("Session encryption key version must be an integer from 1 to 32767");
    }
};

const currentConfig = (config?: SessionEncryptionConfig) => {
    const resolved = config ?? parseSessionEncryptionConfig({
        HRMS_SESSION_ENCRYPTION_KEY: process.env.HRMS_SESSION_ENCRYPTION_KEY!,
        HRMS_SESSION_ENCRYPTION_KEY_VERSION: process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION!
    });
    validateConfig(resolved);
    return resolved;
};

const additionalData = (sessionId: string, userId: string) =>
    Buffer.from(`hrms-session:v1:${sessionId.toLowerCase()}:${userId.toLowerCase()}`, "utf8");

const validateCredentials = (value: unknown): SessionCredentials => {
    if (!value || typeof value !== "object") throw new Error("Invalid session credentials payload");
    const credentials = value as Partial<SessionCredentials>;
    if (typeof credentials.accessToken !== "string" || !credentials.accessToken.trim()
        || typeof credentials.refreshToken !== "string" || !credentials.refreshToken.trim()) {
        throw new Error("Invalid session credentials payload");
    }
    return { accessToken: credentials.accessToken, refreshToken: credentials.refreshToken };
};

export const encryptSessionCredentials = (
    sessionId: string,
    userId: string,
    credentialsInput: SessionCredentials,
    config?: SessionEncryptionConfig
): EncryptedSessionCredentials => {
    validateContext(sessionId, userId);
    const resolvedConfig = currentConfig(config);
    const credentials = validateCredentials(credentialsInput);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", resolvedConfig.key, nonce, { authTagLength: 16 });
    cipher.setAAD(additionalData(sessionId, userId));
    const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(credentials), "utf8"),
        cipher.final()
    ]);

    return {
        ciphertext,
        nonce,
        authTag: cipher.getAuthTag(),
        keyVersion: resolvedConfig.keyVersion
    };
};

export const decryptSessionCredentials = (
    sessionId: string,
    userId: string,
    encrypted: EncryptedSessionCredentials,
    config?: SessionEncryptionConfig
): SessionCredentials => {
    validateContext(sessionId, userId);
    const resolvedConfig = currentConfig(config);
    if (encrypted.keyVersion !== resolvedConfig.keyVersion) {
        throw new Error(`Unsupported session encryption key version: ${encrypted.keyVersion}`);
    }
    if (!Buffer.isBuffer(encrypted.nonce) || encrypted.nonce.length !== 12) {
        throw new Error("Session credential nonce must be exactly 12 bytes");
    }
    if (!Buffer.isBuffer(encrypted.authTag) || encrypted.authTag.length !== 16) {
        throw new Error("Session credential authentication tag must be exactly 16 bytes");
    }
    if (!Buffer.isBuffer(encrypted.ciphertext) || encrypted.ciphertext.length === 0) {
        throw new Error("Session credential ciphertext must not be empty");
    }

    try {
        const decipher = createDecipheriv("aes-256-gcm", resolvedConfig.key, encrypted.nonce, { authTagLength: 16 });
        decipher.setAAD(additionalData(sessionId, userId));
        decipher.setAuthTag(encrypted.authTag);
        const plaintext = Buffer.concat([
            decipher.update(encrypted.ciphertext),
            decipher.final()
        ]).toString("utf8");
        return validateCredentials(JSON.parse(plaintext) as unknown);
    } catch {
        throw new Error("Session credential authentication or payload validation failed");
    }
};
