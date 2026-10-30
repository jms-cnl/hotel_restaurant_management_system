import { randomBytes, randomUUID } from "node:crypto";
import type { SessionEncryptionConfig } from "../config/session-config.js";
import { parseSessionEncryptionConfig } from "../config/session-config.js";
import {
    decryptSessionCredentials,
    encryptSessionCredentials,
    type SessionCredentials
} from "./session-crypto.js";
import { sessionIdleTimeoutForRoleMs } from "./session-policy.js";
export { isSessionIdleExpiredForRole, sessionIdleTimeoutForRoleMs } from "./session-policy.js";
export { verifySessionCsrfToken } from "./session-crypto.js";
import {
    claimRefreshLease as storeClaimRefreshLease,
    commitRefreshedCredentials as storeCommitRefreshedCredentials,
    createSessionRecord,
    failClosedRefreshLease as storeFailClosedRefreshLease,
    findSessionByCookieSecret,
    releaseRefreshLease as storeReleaseRefreshLease,
    revokeSession as storeRevokeSession,
    updateSessionActivity as storeUpdateSessionActivity,
    updateSessionCsrfHash as storeUpdateSessionCsrfHash,
    verifyRefreshLease as storeVerifyRefreshLease,
    type RefreshLeaseIdentity,
    type SessionRecord
} from "./session-store.js";

const refreshLeaseDurationMs = 30 * 1000;
const secretByteLength = 32;
const base64UrlSecretPattern = /^[A-Za-z0-9_-]{43}$/;

export type CreateSessionInput = {
    userId: string;
    roleName: string;
    credentials: SessionCredentials;
    accessTokenExpiresAt: Date;
};

export type SessionMetadata = {
    sessionId: string;
    userId: string;
    purpose: "app" | "recovery";
    scope: "application" | "password_reset";
    accessTokenExpiresAt: string;
    createdAt: string;
    lastActivityAt: string;
    idleExpiresAt: string;
    credentialsVersion: number;
    refreshState: "idle" | "in_flight" | "uncertain";
    refreshLockId: string | null;
    refreshLeaseUntil: string | null;
};

export type ResolvedSession = {
    session: SessionMetadata;
    credentials: SessionCredentials;
    csrfTokenHash: Buffer;
};

export type RefreshLease = RefreshLeaseIdentity & {
    userId: string;
    leaseUntil: Date;
    startedAt: Date;
};

export type SessionServiceStore = {
    createSessionRecord: typeof createSessionRecord;
    findSessionByCookieSecret: typeof findSessionByCookieSecret;
    updateSessionActivity: typeof storeUpdateSessionActivity;
    updateSessionCsrfHash: typeof storeUpdateSessionCsrfHash;
    revokeSession: typeof storeRevokeSession;
    claimRefreshLease: typeof storeClaimRefreshLease;
    verifyRefreshLease: typeof storeVerifyRefreshLease;
    commitRefreshedCredentials: typeof storeCommitRefreshedCredentials;
    releaseRefreshLease: typeof storeReleaseRefreshLease;
    failClosedRefreshLease: typeof storeFailClosedRefreshLease;
};

export type SessionServiceOptions = {
    store?: SessionServiceStore;
    getEncryptionConfig?: () => SessionEncryptionConfig;
    now?: () => Date;
    makeId?: () => string;
    makeSecret?: (size: number) => Buffer;
    refreshCredentials?: (refreshToken: string) => Promise<{
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
    }>;
};

export type ResolveSessionOptions = { allowRecovery?: boolean };

const defaultStore: SessionServiceStore = {
    createSessionRecord,
    findSessionByCookieSecret,
    updateSessionActivity: storeUpdateSessionActivity,
    updateSessionCsrfHash: storeUpdateSessionCsrfHash,
    revokeSession: storeRevokeSession,
    claimRefreshLease: storeClaimRefreshLease,
    verifyRefreshLease: storeVerifyRefreshLease,
    commitRefreshedCredentials: storeCommitRefreshedCredentials,
    releaseRefreshLease: storeReleaseRefreshLease,
    failClosedRefreshLease: storeFailClosedRefreshLease
};

const decodeCookieSecret = (secret: string): Buffer | null => {
    if (!base64UrlSecretPattern.test(secret)) return null;
    const decoded = Buffer.from(secret, "base64url");
    return decoded.length === secretByteLength && decoded.toString("base64url") === secret ? decoded : null;
};

const metadataFromRecord = (record: SessionRecord): SessionMetadata => {
    if (!record.accessTokenExpiresAt) throw new Error("Active session has no access-token expiry");
    return {
        sessionId: record.sessionId,
        userId: record.userId,
        purpose: record.purpose,
        scope: record.scope,
        accessTokenExpiresAt: record.accessTokenExpiresAt,
        createdAt: record.createdAt,
        lastActivityAt: record.lastActivityAt,
        idleExpiresAt: record.idleExpiresAt,
        credentialsVersion: record.credentialsVersion,
        refreshState: record.refreshState,
        refreshLockId: record.refreshLockId,
        refreshLeaseUntil: record.refreshLeaseUntil
    };
};

export const createSessionService = (options: SessionServiceOptions = {}) => {
    const store = options.store ?? defaultStore;
    const getConfig = options.getEncryptionConfig ?? (() => parseSessionEncryptionConfig({
        HRMS_SESSION_ENCRYPTION_KEY: process.env.HRMS_SESSION_ENCRYPTION_KEY!,
        HRMS_SESSION_ENCRYPTION_KEY_VERSION: process.env.HRMS_SESSION_ENCRYPTION_KEY_VERSION!
    }));
    const now = options.now ?? (() => new Date());
    const makeId = options.makeId ?? randomUUID;
    const makeSecret = options.makeSecret ?? randomBytes;
    const refreshCredentials = options.refreshCredentials ?? refreshWithSupabase;

    const issueSession = async (
        input: CreateSessionInput,
        purpose: "app" | "recovery",
        nowAt: Date
    ) => {
        const timeout = sessionIdleTimeoutForRoleMs(input.roleName);
        if (!(input.accessTokenExpiresAt instanceof Date) || !Number.isFinite(input.accessTokenExpiresAt.getTime())) {
            throw new Error("Invalid access-token expiry");
        }
        if (input.accessTokenExpiresAt.getTime() <= nowAt.getTime()) throw new Error("Access token is already expired");

        const sessionId = makeId();
        const cookieBytes = makeSecret(secretByteLength);
        const csrfBytes = makeSecret(secretByteLength);
        if (!Buffer.isBuffer(cookieBytes) || cookieBytes.length !== secretByteLength
            || !Buffer.isBuffer(csrfBytes) || csrfBytes.length !== secretByteLength) {
            throw new Error("Secure session secrets must be exactly 32 bytes");
        }
        const scope = purpose === "app" ? "application" : "password_reset";
        const encrypted = encryptSessionCredentials(sessionId, input.userId, input.credentials, getConfig());
        const idleExpiresAt = new Date(nowAt.getTime() + timeout);
        const record = await store.createSessionRecord({
            sessionId,
            userId: input.userId,
            rawCookieSecret: cookieBytes,
            rawCsrfToken: csrfBytes,
            credentials: encrypted,
            accessTokenExpiresAt: input.accessTokenExpiresAt,
            lastRefreshedAt: nowAt,
            createdAt: nowAt,
            lastActivityAt: nowAt,
            idleExpiresAt,
            purpose,
            scope
        });
        if (record.sessionId !== sessionId || record.userId !== input.userId
            || record.purpose !== purpose || record.scope !== scope || record.revokedAt !== null) {
            throw new Error("Session store returned an invalid created session");
        }

        return {
            cookieSecret: cookieBytes.toString("base64url"),
            csrfToken: csrfBytes.toString("base64url"),
            session: metadataFromRecord(record)
        };
    };

    const createApplicationSession = (input: CreateSessionInput, nowAt = now()) =>
        issueSession(input, "app", nowAt);

    const createRecoverySession = (input: CreateSessionInput, nowAt = now()) =>
        issueSession(input, "recovery", nowAt);

    const resolveSession = async (
        cookieSecret: string,
        nowAt = now(),
        resolveOptions: ResolveSessionOptions = {}
    ): Promise<ResolvedSession | null> => {
        const cookieBytes = decodeCookieSecret(cookieSecret);
        if (!cookieBytes) return null;

        const record = await store.findSessionByCookieSecret(cookieBytes);
        if (!record || record.revokedAt) return null;
        if (Date.parse(record.idleExpiresAt) <= nowAt.getTime()) {
            await store.revokeSession({ sessionId: record.sessionId, revokedAt: nowAt });
            return null;
        }
        if (record.refreshState === "in_flight" && record.refreshLeaseUntil
            && Date.parse(record.refreshLeaseUntil) <= nowAt.getTime()) {
            if (!record.refreshLockId) throw new Error("Expired refresh lease is missing its owner ID");
            await store.failClosedRefreshLease({
                sessionId: record.sessionId,
                expectedCredentialsVersion: record.credentialsVersion,
                leaseId: record.refreshLockId,
                revokedAt: nowAt
            });
            return null;
        }
        if (record.purpose === "recovery" && !resolveOptions.allowRecovery) return null;
        if (!record.credentials || !record.csrfTokenHash) {
            throw new Error("Active session is missing encrypted credentials or CSRF hash");
        }

        let credentials: SessionCredentials;
        try {
            credentials = decryptSessionCredentials(record.sessionId, record.userId, record.credentials, getConfig());
        } catch (error) {
            if (error instanceof Error && /authentication or payload validation failed/i.test(error.message)) {
                await store.revokeSession({ sessionId: record.sessionId, revokedAt: nowAt });
                return null;
            }
            throw error;
        }

        const resolved: ResolvedSession = {
            session: metadataFromRecord(record),
            credentials,
            csrfTokenHash: record.csrfTokenHash
        };
        const expiry = Date.parse(record.accessTokenExpiresAt!);
        if (expiry - nowAt.getTime() > 60_000) return resolved;

        const lease = await claimRefresh(record.sessionId, record.userId, record.credentialsVersion, nowAt);
        if (!lease) return null;
        if (!await verifyRefreshLease(lease, nowAt)) {
            await releasePreDispatchRefreshLease(lease, nowAt);
            return null;
        }

        let refreshed: { accessToken: string; refreshToken: string; expiresAt: Date };
        try {
            refreshed = await refreshCredentials(credentials.refreshToken);
            if (!refreshed.accessToken || !refreshed.refreshToken
                || !(refreshed.expiresAt instanceof Date)
                || !Number.isFinite(refreshed.expiresAt.getTime())
                || refreshed.expiresAt.getTime() <= nowAt.getTime()) {
                throw new Error("Invalid refreshed credentials");
            }
        } catch {
            await failClosedRefresh(lease, nowAt);
            return null;
        }

        const commitTime = now();
        if (!await verifyRefreshLease(lease, commitTime)) {
            await failClosedRefresh(lease, commitTime);
            return null;
        }
        const refreshedCredentials = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
        if (!await commitRefresh(lease, refreshedCredentials, refreshed.expiresAt, commitTime)) {
            await failClosedRefresh(lease, commitTime);
            return null;
        }
        return {
            session: {
                ...resolved.session,
                accessTokenExpiresAt: refreshed.expiresAt.toISOString(),
                credentialsVersion: resolved.session.credentialsVersion + 1,
                refreshState: "idle",
                refreshLockId: null,
                refreshLeaseUntil: null
            },
            credentials: refreshedCredentials,
            csrfTokenHash: resolved.csrfTokenHash
        };
    };

    const recordMeaningfulActivity = async (sessionId: string, roleName: string, nowAt = now()) => {
        const lastActivityAt = new Date(nowAt.getTime());
        const idleExpiresAt = new Date(nowAt.getTime() + sessionIdleTimeoutForRoleMs(roleName));
        return store.updateSessionActivity({ sessionId, lastActivityAt, idleExpiresAt });
    };

    const rotateCsrfToken = async (sessionId: string, nowAt = now()) => {
        const tokenBytes = makeSecret(secretByteLength);
        if (tokenBytes.length !== secretByteLength) throw new Error("CSRF token must be exactly 32 bytes");
        const updated = await store.updateSessionCsrfHash({ sessionId, rawCsrfToken: tokenBytes, now: nowAt });
        return updated ? tokenBytes.toString("base64url") : null;
    };

    const revokeCurrentSession = (sessionId: string, revokedAt = now()) =>
        store.revokeSession({ sessionId, revokedAt });

    const claimRefresh = async (sessionId: string, userId: string, expectedCredentialsVersion: number, nowAt = now()): Promise<RefreshLease | null> => {
        const leaseId = makeId();
        const leaseUntil = new Date(nowAt.getTime() + refreshLeaseDurationMs);
        const record = await store.claimRefreshLease({
            sessionId,
            expectedCredentialsVersion,
            leaseId,
            leaseUntil,
            startedAt: nowAt,
            now: nowAt
        });
        if (!record) return null;
        if (record.sessionId !== sessionId || record.userId !== userId
            || record.credentialsVersion !== expectedCredentialsVersion
            || record.refreshState !== "in_flight" || record.refreshLockId !== leaseId) {
            throw new Error("Session store returned an invalid refresh lease claim");
        }
        return { sessionId, userId, expectedCredentialsVersion, leaseId, leaseUntil, startedAt: nowAt };
    };

    const verifyRefreshLease = (lease: RefreshLease, nowAt = now()) =>
        store.verifyRefreshLease({
            sessionId: lease.sessionId,
            expectedCredentialsVersion: lease.expectedCredentialsVersion,
            leaseId: lease.leaseId,
            now: nowAt
        });

    const commitRefresh = (lease: RefreshLease, credentials: SessionCredentials, accessTokenExpiresAt: Date, nowAt = now()) => {
        if (!(accessTokenExpiresAt instanceof Date) || !Number.isFinite(accessTokenExpiresAt.getTime())
            || accessTokenExpiresAt.getTime() <= nowAt.getTime()) {
            throw new Error("Refreshed access token must have a future expiry");
        }
        const encrypted = encryptSessionCredentials(lease.sessionId, lease.userId, credentials, getConfig());
        return store.commitRefreshedCredentials({
            sessionId: lease.sessionId,
            expectedCredentialsVersion: lease.expectedCredentialsVersion,
            leaseId: lease.leaseId,
            credentials: encrypted,
            accessTokenExpiresAt,
            refreshedAt: nowAt,
            now: nowAt
        });
    };

    const releasePreDispatchRefreshLease = (lease: RefreshLease, nowAt = now()) =>
        store.releaseRefreshLease({
            sessionId: lease.sessionId,
            expectedCredentialsVersion: lease.expectedCredentialsVersion,
            leaseId: lease.leaseId,
            now: nowAt
        });

    const failClosedRefresh = (lease: RefreshLease, revokedAt = now()) =>
        store.failClosedRefreshLease({
            sessionId: lease.sessionId,
            expectedCredentialsVersion: lease.expectedCredentialsVersion,
            leaseId: lease.leaseId,
            revokedAt
        });

    return {
        createApplicationSession,
        createRecoverySession,
        resolveSession,
        recordMeaningfulActivity,
        rotateCsrfToken,
        revokeCurrentSession,
        claimRefresh,
        verifyRefreshLease,
        commitRefresh,
        releasePreDispatchRefreshLease,
        failClosedRefresh
    };
};

export const sessionService = createSessionService();

async function refreshWithSupabase(refreshToken: string) {
    const url = process.env.SUPABASE_URL?.trim();
    const apiKey = process.env.SUPABASE_KEY?.trim();
    if (!url || !apiKey) throw new Error("Supabase Auth refresh is not configured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error("Supabase Auth refresh failed");
        const payload = await response.json() as {
            access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; expires_in?: unknown;
        };
        if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
            throw new Error("Supabase Auth returned invalid refresh credentials");
        }
        const expiresAt = typeof payload.expires_at === "number"
            ? new Date(payload.expires_at * 1000)
            : new Date(Date.now() + Number(payload.expires_in) * 1000);
        return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt };
    } finally {
        clearTimeout(timeout);
    }
}
