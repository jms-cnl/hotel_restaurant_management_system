import { createHash } from "node:crypto";
import type { EncryptedSessionCredentials } from "./session-crypto.js";
import { sessionStoreClient } from "../config/session-store-client.js";

export type SessionPurpose = "app" | "recovery";
export type SessionScope = "application" | "password_reset";
export type RefreshState = "idle" | "in_flight" | "uncertain";

export type SessionRecord = {
    sessionId: string;
    userId: string;
    cookieHash: Buffer;
    credentials: EncryptedSessionCredentials | null;
    accessTokenExpiresAt: string | null;
    lastRefreshedAt: string | null;
    createdAt: string;
    lastActivityAt: string;
    idleExpiresAt: string;
    revokedAt: string | null;
    csrfTokenHash: Buffer | null;
    purpose: SessionPurpose;
    scope: SessionScope;
    credentialsVersion: number;
    refreshState: RefreshState;
    refreshLockId: string | null;
    refreshLeaseUntil: string | null;
    refreshStartedAt: string | null;
};

type QueryResult = { data: unknown; error: unknown };
type SessionQuery = {
    insert(value: Record<string, unknown>): SessionQuery;
    update(value: Record<string, unknown>): SessionQuery;
    select(columns?: string): SessionQuery;
    eq(column: string, value: unknown): SessionQuery;
    is(column: string, value: unknown): SessionQuery;
    gt(column: string, value: unknown): SessionQuery;
    maybeSingle(): Promise<QueryResult>;
    single(): Promise<QueryResult>;
};
export type SessionStoreClient = {
    from(table: "hrm_sessions"): SessionQuery;
};

export class SessionStoreError extends Error {
    readonly operation: string;

    constructor(operation: string, cause?: unknown) {
        super(`Session store operation failed: ${operation}`, cause === undefined ? undefined : { cause });
        this.name = "SessionStoreError";
        this.operation = operation;
    }
}

const defaultClient = sessionStoreClient as unknown as SessionStoreClient;
const encodeBytea = (value: Uint8Array) => `\\x${Buffer.from(value).toString("hex")}`;

const decodeBytea = (value: unknown, column: string): Buffer => {
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (typeof value === "string" && /^\\x(?:[0-9a-f]{2})*$/i.test(value)) {
        return Buffer.from(value.slice(2), "hex");
    }
    throw new SessionStoreError(`decode ${column}`);
};

const asRecord = (value: unknown, operation: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new SessionStoreError(`read ${operation}`);
    }
    return value as Record<string, unknown>;
};

const asString = (row: Record<string, unknown>, column: string): string => {
    if (typeof row[column] !== "string") throw new SessionStoreError(`read ${column}`);
    return row[column] as string;
};

const asNullableString = (row: Record<string, unknown>, column: string): string | null => {
    const value = row[column];
    if (value === null) return null;
    if (typeof value !== "string") throw new SessionStoreError(`read ${column}`);
    return value;
};

const toIso = (value: Date, field: string) => {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        throw new SessionStoreError(`validate ${field}`);
    }
    return value.toISOString();
};

const asSafeInteger = (value: unknown, field: string) => {
    const numberValue = typeof value === "string" ? Number(value) : value;
    if (typeof numberValue !== "number" || !Number.isSafeInteger(numberValue) || numberValue < 0) {
        throw new SessionStoreError(`read ${field}`);
    }
    return numberValue;
};

const validateVersion = (value: number, field: string, allowIncrement = false) => {
    if (!Number.isSafeInteger(value) || value < 0 || (allowIncrement && value >= Number.MAX_SAFE_INTEGER)) {
        throw new SessionStoreError(`validate ${field}`);
    }
};

const validateEncryptedCredentials = (credentials: EncryptedSessionCredentials) => {
    if (!Buffer.isBuffer(credentials.ciphertext) || credentials.ciphertext.length === 0
        || !Buffer.isBuffer(credentials.nonce) || credentials.nonce.length !== 12
        || !Buffer.isBuffer(credentials.authTag) || credentials.authTag.length !== 16
        || !Number.isInteger(credentials.keyVersion) || credentials.keyVersion < 1 || credentials.keyVersion > 32767) {
        throw new SessionStoreError("validate encrypted credentials");
    }
};

const mapSessionRow = (value: unknown): SessionRecord => {
    const row = asRecord(value, "session row");
    const ciphertext = row.credentials_ciphertext;
    const nonce = row.credentials_nonce;
    const authTag = row.credentials_auth_tag;
    const keyVersion = row.credentials_key_version;
    const allCryptoNull = ciphertext === null && nonce === null && authTag === null && keyVersion === null;
    const allCryptoPresent = ciphertext !== null && nonce !== null && authTag !== null && keyVersion !== null;
    if (!allCryptoNull && !allCryptoPresent) throw new SessionStoreError("read credential metadata");

    let credentials: EncryptedSessionCredentials | null = null;
    if (allCryptoPresent) {
        if (typeof keyVersion !== "number" || !Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 32767) {
            throw new SessionStoreError("read credential key version");
        }
        credentials = {
            ciphertext: decodeBytea(ciphertext, "credentials_ciphertext"),
            nonce: decodeBytea(nonce, "credentials_nonce"),
            authTag: decodeBytea(authTag, "credentials_auth_tag"),
            keyVersion
        };
        if (credentials.ciphertext.length === 0 || credentials.nonce.length !== 12 || credentials.authTag.length !== 16) {
            throw new SessionStoreError("validate credential metadata");
        }
    }

    const csrfValue = row.csrf_token_hash;
    const csrfTokenHash = csrfValue === null ? null : decodeBytea(csrfValue, "csrf_token_hash");
    if (csrfTokenHash && csrfTokenHash.length !== 32) throw new SessionStoreError("validate CSRF hash");

    const purpose = asString(row, "purpose");
    const scope = asString(row, "scope");
    if (!((purpose === "app" && scope === "application") || (purpose === "recovery" && scope === "password_reset"))) {
        throw new SessionStoreError("validate session purpose");
    }

    const refreshState = asString(row, "refresh_state");
    if (refreshState !== "idle" && refreshState !== "in_flight" && refreshState !== "uncertain") {
        throw new SessionStoreError("read refresh state");
    }

    const cookieHash = decodeBytea(row.cookie_hash, "cookie_hash");
    if (cookieHash.length !== 32) throw new SessionStoreError("validate cookie hash");

    const record: SessionRecord = {
        sessionId: asString(row, "session_id"),
        userId: asString(row, "user_id"),
        cookieHash,
        credentials,
        accessTokenExpiresAt: asNullableString(row, "access_token_expires_at"),
        lastRefreshedAt: asNullableString(row, "last_refreshed_at"),
        createdAt: asString(row, "created_at"),
        lastActivityAt: asString(row, "last_activity_at"),
        idleExpiresAt: asString(row, "idle_expires_at"),
        revokedAt: asNullableString(row, "revoked_at"),
        csrfTokenHash,
        purpose: purpose as SessionPurpose,
        scope: scope as SessionScope,
        credentialsVersion: asSafeInteger(row.credentials_version, "credentials_version"),
        refreshState: refreshState as RefreshState,
        refreshLockId: asNullableString(row, "refresh_lock_id"),
        refreshLeaseUntil: asNullableString(row, "refresh_lease_until"),
        refreshStartedAt: asNullableString(row, "refresh_started_at")
    };

    if (record.revokedAt === null) {
        if (!record.credentials || !record.csrfTokenHash || !record.accessTokenExpiresAt) {
            throw new SessionStoreError("validate active session material");
        }
    } else if (record.credentials || record.csrfTokenHash) {
        throw new SessionStoreError("validate revoked session material");
    }

    if (record.refreshState === "idle"
        && (record.refreshLockId !== null || record.refreshLeaseUntil !== null || record.refreshStartedAt !== null)) {
        throw new SessionStoreError("validate idle refresh state");
    }
    if (record.refreshState === "in_flight"
        && (!record.refreshLockId || !record.refreshLeaseUntil || !record.refreshStartedAt || record.revokedAt !== null)) {
        throw new SessionStoreError("validate in-flight refresh state");
    }
    if (record.refreshState === "uncertain"
        && (record.refreshLockId !== null || record.refreshLeaseUntil !== null || !record.refreshStartedAt || record.revokedAt === null)) {
        throw new SessionStoreError("validate uncertain refresh state");
    }
    return record;
};

const checkDatabaseError = (error: unknown, operation: string) => {
    if (error !== null && error !== undefined) throw new SessionStoreError(operation, error);
};

const maybeRecord = (result: QueryResult, operation: string): SessionRecord | null => {
    checkDatabaseError(result.error, operation);
    if (result.data === null) return null;
    if (result.data === undefined) throw new SessionStoreError(`${operation} returned no result`);
    return mapSessionRow(result.data);
};

const didUpdate = (result: QueryResult, operation: string): boolean => {
    checkDatabaseError(result.error, operation);
    if (result.data === null) return false;
    if (typeof result.data !== "object" || Array.isArray(result.data)) {
        throw new SessionStoreError(`${operation} returned an invalid result`);
    }
    return true;
};

const require32Bytes = (value: Uint8Array, field: string) => {
    if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
        throw new SessionStoreError(`validate ${field}`);
    }
};

const hashToken = (value: Uint8Array) => createHash("sha256").update(value).digest();

export type CreateSessionRecordInput = {
    sessionId: string;
    userId: string;
    rawCookieSecret: Uint8Array;
    rawCsrfToken: Uint8Array;
    credentials: EncryptedSessionCredentials;
    accessTokenExpiresAt: Date;
    lastRefreshedAt: Date;
    createdAt: Date;
    lastActivityAt: Date;
    idleExpiresAt: Date;
    purpose: SessionPurpose;
    scope: SessionScope;
};

export const createSessionRecord = async (
    input: CreateSessionRecordInput,
    client: SessionStoreClient = defaultClient
): Promise<SessionRecord> => {
    require32Bytes(input.rawCookieSecret, "cookie secret");
    require32Bytes(input.rawCsrfToken, "CSRF token");
    validateEncryptedCredentials(input.credentials);
    if (!((input.purpose === "app" && input.scope === "application")
        || (input.purpose === "recovery" && input.scope === "password_reset"))) {
        throw new SessionStoreError("validate purpose and scope");
    }
    const createdAt = toIso(input.createdAt, "created_at");
    const lastActivityAt = toIso(input.lastActivityAt, "last_activity_at");
    const idleExpiresAt = toIso(input.idleExpiresAt, "idle_expires_at");
    if (Date.parse(idleExpiresAt) <= Date.parse(lastActivityAt)) throw new SessionStoreError("validate idle expiry");

    const values = {
        session_id: input.sessionId,
        cookie_hash: encodeBytea(hashToken(input.rawCookieSecret)),
        user_id: input.userId,
        credentials_ciphertext: encodeBytea(input.credentials.ciphertext),
        credentials_nonce: encodeBytea(input.credentials.nonce),
        credentials_auth_tag: encodeBytea(input.credentials.authTag),
        credentials_key_version: input.credentials.keyVersion,
        access_token_expires_at: toIso(input.accessTokenExpiresAt, "access_token_expires_at"),
        last_refreshed_at: toIso(input.lastRefreshedAt, "last_refreshed_at"),
        created_at: createdAt,
        last_activity_at: lastActivityAt,
        idle_expires_at: idleExpiresAt,
        revoked_at: null,
        csrf_token_hash: encodeBytea(hashToken(input.rawCsrfToken)),
        purpose: input.purpose,
        scope: input.scope,
        credentials_version: 0,
        refresh_state: "idle",
        refresh_lock_id: null,
        refresh_lease_until: null,
        refresh_started_at: null
    };

    const result = await client.from("hrm_sessions").insert(values).select("*").single();
    checkDatabaseError(result.error, "create session");
    if (result.data === null || result.data === undefined) throw new SessionStoreError("create session returned no row");
    return mapSessionRow(result.data);
};

export const findSessionByCookieSecret = async (
    rawCookieSecret: Uint8Array,
    client: SessionStoreClient = defaultClient
): Promise<SessionRecord | null> => {
    require32Bytes(rawCookieSecret, "cookie secret");
    const cookieHash = encodeBytea(hashToken(rawCookieSecret));
    const result = await client.from("hrm_sessions")
        .select("*")
        .eq("cookie_hash", cookieHash)
        .maybeSingle();
    return maybeRecord(result, "find session");
};

export type RefreshLeaseClaim = {
    sessionId: string;
    expectedCredentialsVersion: number;
    leaseId: string;
    leaseUntil: Date;
    startedAt: Date;
    now: Date;
};

export const claimRefreshLease = async (
    input: RefreshLeaseClaim,
    client: SessionStoreClient = defaultClient
): Promise<SessionRecord | null> => {
    validateVersion(input.expectedCredentialsVersion, "refresh credentials version");
    const now = toIso(input.now, "refresh claim time");
    const leaseUntil = toIso(input.leaseUntil, "refresh lease expiry");
    const startedAt = toIso(input.startedAt, "refresh start time");
    if (Date.parse(leaseUntil) <= Date.parse(now) || Date.parse(startedAt) > Date.parse(now)) {
        throw new SessionStoreError("validate refresh lease window");
    }
    const result = await client.from("hrm_sessions")
        .update({
            refresh_state: "in_flight",
            refresh_lock_id: input.leaseId,
            refresh_lease_until: leaseUntil,
            refresh_started_at: startedAt
        })
        .eq("session_id", input.sessionId)
        .eq("credentials_version", input.expectedCredentialsVersion)
        .eq("refresh_state", "idle")
        .is("revoked_at", null)
        .gt("idle_expires_at", now)
        .select("*")
        .maybeSingle();
    return maybeRecord(result, "claim refresh lease");
};

export type RefreshLeaseIdentity = {
    sessionId: string;
    expectedCredentialsVersion: number;
    leaseId: string;
};

export const verifyRefreshLease = async (
    input: RefreshLeaseIdentity & { now: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    validateVersion(input.expectedCredentialsVersion, "refresh credentials version");
    const result = await client.from("hrm_sessions")
        .select("session_id")
        .eq("session_id", input.sessionId)
        .eq("credentials_version", input.expectedCredentialsVersion)
        .eq("refresh_lock_id", input.leaseId)
        .eq("refresh_state", "in_flight")
        .is("revoked_at", null)
        .gt("refresh_lease_until", toIso(input.now, "lease verification time"))
        .maybeSingle();
    checkDatabaseError(result.error, "verify refresh lease");
    if (result.data === null) return false;
    if (result.data === undefined) throw new SessionStoreError("verify refresh lease returned no result");
    return true;
};

export const commitRefreshedCredentials = async (
    input: RefreshLeaseIdentity & {
        credentials: EncryptedSessionCredentials;
        accessTokenExpiresAt: Date;
        refreshedAt: Date;
        now: Date;
    },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    validateVersion(input.expectedCredentialsVersion, "refresh credentials version", true);
    validateEncryptedCredentials(input.credentials);
    const result = await client.from("hrm_sessions")
        .update({
            credentials_ciphertext: encodeBytea(input.credentials.ciphertext),
            credentials_nonce: encodeBytea(input.credentials.nonce),
            credentials_auth_tag: encodeBytea(input.credentials.authTag),
            credentials_key_version: input.credentials.keyVersion,
            access_token_expires_at: toIso(input.accessTokenExpiresAt, "access token expiry"),
            last_refreshed_at: toIso(input.refreshedAt, "refresh timestamp"),
            credentials_version: input.expectedCredentialsVersion + 1,
            refresh_state: "idle",
            refresh_lock_id: null,
            refresh_lease_until: null,
            refresh_started_at: null
        })
        .eq("session_id", input.sessionId)
        .eq("refresh_lock_id", input.leaseId)
        .eq("credentials_version", input.expectedCredentialsVersion)
        .eq("refresh_state", "in_flight")
        .is("revoked_at", null)
        .gt("refresh_lease_until", toIso(input.now, "refresh commit time"))
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "commit refreshed credentials");
};

export const releaseRefreshLease = async (
    input: RefreshLeaseIdentity & { now: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    validateVersion(input.expectedCredentialsVersion, "refresh credentials version");
    const result = await client.from("hrm_sessions")
        .update({
            refresh_state: "idle",
            refresh_lock_id: null,
            refresh_lease_until: null,
            refresh_started_at: null
        })
        .eq("session_id", input.sessionId)
        .eq("refresh_lock_id", input.leaseId)
        .eq("credentials_version", input.expectedCredentialsVersion)
        .eq("refresh_state", "in_flight")
        .is("revoked_at", null)
        .gt("refresh_lease_until", toIso(input.now, "lease release time"))
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "release refresh lease");
};

export const failClosedRefreshLease = async (
    input: RefreshLeaseIdentity & { revokedAt: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    validateVersion(input.expectedCredentialsVersion, "refresh credentials version");
    const result = await client.from("hrm_sessions")
        .update({
            revoked_at: toIso(input.revokedAt, "refresh failure revocation time"),
            credentials_ciphertext: null,
            credentials_nonce: null,
            credentials_auth_tag: null,
            credentials_key_version: null,
            csrf_token_hash: null,
            refresh_state: "uncertain",
            refresh_lock_id: null,
            refresh_lease_until: null
        })
        .eq("session_id", input.sessionId)
        .eq("refresh_lock_id", input.leaseId)
        .eq("credentials_version", input.expectedCredentialsVersion)
        .eq("refresh_state", "in_flight")
        .is("revoked_at", null)
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "fail closed refresh lease");
};

export const updateSessionActivity = async (
    input: { sessionId: string; lastActivityAt: Date; idleExpiresAt: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    const activityAt = toIso(input.lastActivityAt, "last activity time");
    const expiryAt = toIso(input.idleExpiresAt, "idle expiry");
    if (Date.parse(expiryAt) <= Date.parse(activityAt)) throw new SessionStoreError("validate idle expiry");

    const result = await client.from("hrm_sessions")
        .update({ last_activity_at: activityAt, idle_expires_at: expiryAt })
        .eq("session_id", input.sessionId)
        .is("revoked_at", null)
        .gt("idle_expires_at", activityAt)
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "update session activity");
};

export const updateSessionCsrfHash = async (
    input: { sessionId: string; rawCsrfToken: Uint8Array; now: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    require32Bytes(input.rawCsrfToken, "CSRF token");
    const result = await client.from("hrm_sessions")
        .update({ csrf_token_hash: encodeBytea(hashToken(input.rawCsrfToken)) })
        .eq("session_id", input.sessionId)
        .is("revoked_at", null)
        .gt("idle_expires_at", toIso(input.now, "CSRF token rotation time"))
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "update session CSRF hash");
};

export const revokeSession = async (
    input: { sessionId: string; revokedAt: Date },
    client: SessionStoreClient = defaultClient
): Promise<boolean> => {
    const result = await client.from("hrm_sessions")
        .update({
            revoked_at: toIso(input.revokedAt, "revocation time"),
            credentials_ciphertext: null,
            credentials_nonce: null,
            credentials_auth_tag: null,
            credentials_key_version: null,
            csrf_token_hash: null,
            refresh_state: "idle",
            refresh_lock_id: null,
            refresh_lease_until: null,
            refresh_started_at: null
        })
        .eq("session_id", input.sessionId)
        .is("revoked_at", null)
        .select("session_id")
        .maybeSingle();
    return didUpdate(result, "revoke session");
};
