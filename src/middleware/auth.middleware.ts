import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { getBearerToken, getRequestSupabase, runWithRequest } from "../config/supabase.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../config/session-cookie.js";
import type { ResolveSessionOptions, ResolvedSession } from "../services/session.service.js";
import { isSessionIdleExpiredForRole, sessionIdleTimeoutForRoleMs } from "../services/session-policy.js";
import { requireSessionCsrf } from "./csrf.middleware.js";

type RoleRecord = { role_name?: string };
type ProfileRecord = { user_id?: string; role_id?: number; role?: RoleRecord | RoleRecord[] | null };
type AuthSupabaseClient = {
    auth: { getUser(token: string): Promise<{ data: { user: User | null }; error: unknown | null }> };
    from(table: "user"): {
        select(columns: string): {
            eq(column: string, value: string): {
                single(): Promise<{ data: unknown; error: unknown | null }>;
            };
        };
    };
};

export type AuthenticationDependencies = {
    resolveSession: (cookieSecret: string, now: Date, options: ResolveSessionOptions) => Promise<ResolvedSession | null>;
    revokeCurrentSession: (sessionId: string, revokedAt: Date) => Promise<boolean>;
    recordMeaningfulActivity: (sessionId: string, roleName: string, now: Date) => Promise<boolean>;
    getRequestSupabase: (req: Request, accessToken: string) => AuthSupabaseClient;
    getProfile: (client: AuthSupabaseClient, userId: string) => Promise<{ profile: ProfileRecord | null; error: unknown | null }>;
    runWithRequest: (req: Request, callback: () => void) => void;
    now: () => Date;
};

const defaultAuthenticationDependencies: AuthenticationDependencies = {
    resolveSession: async (cookieSecret, now, options) => {
        const { sessionService } = await import("../services/session.service.js");
        return sessionService.resolveSession(cookieSecret, now, options);
    },
    revokeCurrentSession: async (sessionId, revokedAt) => {
        const { sessionService } = await import("../services/session.service.js");
        return sessionService.revokeCurrentSession(sessionId, revokedAt);
    },
    recordMeaningfulActivity: async (sessionId, roleName, now) => {
        const { sessionService } = await import("../services/session.service.js");
        return sessionService.recordMeaningfulActivity(sessionId, roleName, now);
    },
    getRequestSupabase: (req, accessToken) => getRequestSupabase(req, accessToken) as unknown as AuthSupabaseClient,
    getProfile: async (client, userId) => {
        const { data, error } = await client
            .from("user")
            .select("user_id, role_id, role(role_name)")
            .eq("user_id", userId)
            .single();
        return { profile: data as ProfileRecord | null, error };
    },
    runWithRequest,
    now: () => new Date()
};

type SessionCookieResult = { present: boolean; invalid: boolean; value?: string };
const sessionRevocationPaths = new Set(["/api/auth/logout", "/api/auth/reset-password"]);

const isSessionRevocationRequest = (req: Request) => {
    if (req.method.toUpperCase() !== "POST") return false;
    const url = req.originalUrl || `${req.baseUrl}${req.path}`;
    const path = (url.split("?", 1)[0] ?? "").replace(/\/+$/, "") || "/";
    return sessionRevocationPaths.has(path);
};

export const readSessionCookie = (req: Request): SessionCookieResult => {
    const header = req.headers.cookie;
    if (!header) return { present: false, invalid: false };

    const matches: string[] = [];
    for (const entry of header.split(";")) {
        const separator = entry.indexOf("=");
        if (separator < 0 || entry.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
        try {
            matches.push(decodeURIComponent(entry.slice(separator + 1).trim()));
        } catch {
            return { present: true, invalid: true };
        }
    }

    if (matches.length === 0) return { present: false, invalid: false };
    if (matches.length !== 1 || !matches[0]) return { present: true, invalid: true };
    return { present: true, invalid: false, value: matches[0] };
};

const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());

const hasRecoveryAmr = (token: string): boolean => {
    try {
        const payload = token.split(".")[1];
        if (!payload) return false;
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
            amr?: Array<string | { method?: string }>;
        };
        return claims.amr?.some((entry) =>
            typeof entry === "string" ? entry === "recovery" : entry.method === "recovery"
        ) ?? false;
    } catch {
        return false;
    }
};

export const createAuthenticationMiddleware = (
    options: { allowRecovery?: boolean; requireCsrf?: boolean; invalidCookieBehavior?: "reject" | "anonymous" | "logged-out" } = {},
    overrides: Partial<AuthenticationDependencies> = {}
) => {
    const dependencies = { ...defaultAuthenticationDependencies, ...overrides };
    const invalidCookieBehavior = options.invalidCookieBehavior ?? "reject";

    const handleInvalidCookie = (req: Request, res: Response, next: NextFunction, message: string) => {
        clearSessionCookie(res);
        if (invalidCookieBehavior === "anonymous") {
            delete req.auth;
            dependencies.runWithRequest(req, next);
            return;
        }
        if (invalidCookieBehavior === "logged-out") {
            res.status(204).send();
            return;
        }
        res.status(401).json({ message });
    };

    return async (req: Request, res: Response, next: NextFunction) => {
        const cookie = readSessionCookie(req);
        if (cookie.invalid) {
            handleInvalidCookie(req, res, next, "Invalid or expired session");
            return;
        }

        const now = dependencies.now();
        let resolved: ResolvedSession | null = null;
        let accessToken: string | null = null;
        let authMethod: "session_cookie" | "legacy_bearer";

        try {
            if (cookie.present) {
                resolved = await dependencies.resolveSession(cookie.value!, now, { allowRecovery: true });
                if (!resolved) {
                    handleInvalidCookie(req, res, next, "Invalid or expired session");
                    return;
                }
                accessToken = resolved.credentials.accessToken;
                authMethod = "session_cookie";
            } else {
                accessToken = getBearerToken(req);
                if (!accessToken) {
                    res.status(401).json({ message: "Authentication required" });
                    return;
                }
                authMethod = "legacy_bearer";
            }

            const client = dependencies.getRequestSupabase(req, accessToken);
            const { data: authData, error: authError } = await client.auth.getUser(accessToken);
            if (authError || !authData.user) {
                if (resolved) {
                    await dependencies.revokeCurrentSession(resolved.session.sessionId, now);
                    handleInvalidCookie(req, res, next, "Invalid or expired access token");
                } else {
                    res.status(401).json({ message: "Invalid or expired access token" });
                }
                return;
            }

            if (resolved && resolved.session.userId !== authData.user.id) {
                await dependencies.revokeCurrentSession(resolved.session.sessionId, now);
                handleInvalidCookie(req, res, next, "Session identity mismatch");
                return;
            }

            const isRecoverySession = resolved?.session.purpose === "recovery"
                || (!resolved && authMethod === "legacy_bearer" && hasRecoveryAmr(accessToken));
            if (isRecoverySession && !options.allowRecovery) {
                if (invalidCookieBehavior === "anonymous" && resolved?.session.purpose === "recovery") {
                    delete req.auth;
                    dependencies.runWithRequest(req, () => next());
                    return;
                }
                res.status(403).json({ message: "Recovery sessions cannot access application routes" });
                return;
            }

            const { profile, error: profileError } = await dependencies.getProfile(client, authData.user.id);
            if (profileError || !profile) {
                if (resolved) handleInvalidCookie(req, res, next, "Authenticated user profile not found");
                else res.status(401).json({ message: "Authenticated user profile not found" });
                return;
            }

            const role = Array.isArray(profile.role) ? profile.role[0] : profile.role;
            if (!role?.role_name || !profile.user_id || typeof profile.role_id !== "number") {
                res.status(403).json({ message: "Authenticated user has no application role" });
                return;
            }

            if (resolved) {
                let roleIdleExpired: boolean;
                try {
                    roleIdleExpired = isSessionIdleExpiredForRole(resolved.session.lastActivityAt, role.role_name, now);
                } catch {
                    await dependencies.revokeCurrentSession(resolved.session.sessionId, now);
                    res.status(403).json({ message: "Authenticated user has an unsupported application role" });
                    return;
                }
                if (roleIdleExpired) {
                    await dependencies.revokeCurrentSession(resolved.session.sessionId, now);
                    handleInvalidCookie(req, res, next, "Session expired due to inactivity");
                    return;
                }
            }

            const authContext = {
                user: authData.user,
                profile: { user_id: profile.user_id, role_id: profile.role_id },
                roleName: role.role_name,
                authMethod,
                ...(resolved ? {
                    sessionId: resolved.session.sessionId,
                    sessionPurpose: resolved.session.purpose,
                    sessionScope: resolved.session.scope,
                    sessionLastActivityAt: resolved.session.lastActivityAt
                } : {})
            } as NonNullable<Request["auth"]>;
            Object.defineProperty(authContext, "accessToken", { value: accessToken, enumerable: false });
            if (resolved) {
                Object.defineProperty(authContext, "csrfTokenHash", { value: resolved.csrfTokenHash, enumerable: false });
            }
            req.auth = authContext;

            dependencies.runWithRequest(req, () => {
                const afterCsrf = (error?: unknown) => {
                    if (error) { next(error); return; }
                    const changesState = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());
                    if (!resolved || !changesState || authMethod !== "session_cookie" || isSessionRevocationRequest(req)) { next(); return; }
                    void dependencies.recordMeaningfulActivity(resolved.session.sessionId, role.role_name!, now)
                        .then((updated) => {
                            if (!updated) { handleInvalidCookie(req, res, next, "Session expired"); return; }
                            res.cookie(SESSION_COOKIE_NAME, cookie.value!, sessionCookieOptions(sessionIdleTimeoutForRoleMs(role.role_name!)));
                            next();
                        })
                        .catch(() => res.status(503).json({ message: "Session service temporarily unavailable" }));
                };
                if (options.requireCsrf === false) afterCsrf();
                else requireSessionCsrf(req, res, afterCsrf);
            });
        } catch {
            res.status(503).json({ message: "Authentication service temporarily unavailable" });
        }
    };
};

export const authenticate = createAuthenticationMiddleware();
const optionalCookieAuthenticate = createAuthenticationMiddleware({ invalidCookieBehavior: "anonymous" });
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
    const cookie = readSessionCookie(req);
    const bearerToken = getBearerToken(req);
    if ((cookie.present || cookie.invalid) && bearerToken === null) {
        return optionalCookieAuthenticate(req, res, next);
    }
    if (cookie.present || cookie.invalid || bearerToken !== null) {
        return authenticate(req, res, next);
    }
    runWithRequest(req, next);
};
export const authenticateRecovery = createAuthenticationMiddleware({ allowRecovery: true });
const logoutAuthenticate = createAuthenticationMiddleware({ allowRecovery: true, invalidCookieBehavior: "logged-out" });
export const authenticateLogout = (req: Request, res: Response, next: NextFunction) => {
    const cookie = readSessionCookie(req);
    if (getBearerToken(req) !== null) return authenticateRecovery(req, res, next);
    if (!cookie.present && !cookie.invalid) {
        clearSessionCookie(res);
        res.status(204).send();
        return;
    }
    return logoutAuthenticate(req, res, next);
};
export const authenticateBootstrap = createAuthenticationMiddleware({ requireCsrf: false });
export const authenticateRecoveryBootstrap = createAuthenticationMiddleware({ allowRecovery: true, requireCsrf: false });

export const requireRecoverySession = (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.sessionPurpose === "recovery" && req.auth.sessionScope === "password_reset") {
        next();
        return;
    }
    res.status(403).json({ message: "A restricted recovery session is required" });
};

export const requireRecoveryToken = (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.sessionPurpose) {
        if (req.auth.sessionPurpose === "recovery" && req.auth.sessionScope === "password_reset") {
            next();
            return;
        }
        res.status(403).json({ message: "Password reset requires a recovery session" });
        return;
    }

    const token = getBearerToken(req);

    try {
        const payload = token?.split(".")[1];
        if (!payload) throw new Error("Invalid token");

        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
            amr?: Array<string | { method?: string }>;
        };
        const isRecovery = claims.amr?.some((entry) =>
            typeof entry === "string" ? entry === "recovery" : entry.method === "recovery"
        );

        if (isRecovery) {
            next();
            return;
        }
    } catch {
        // Reject malformed tokens; authenticate must run first to verify valid tokens.
    }

    res.status(403).json({ message: "Password reset requires a recovery link" });
};

export const requireRole = (...allowedRoles: string[]) => {
    const allowed = new Set(allowedRoles.map((role) => role.toLowerCase()));

    return (req: Request, res: Response, next: NextFunction) => {
        const roleName = req.auth?.roleName;

        if (!roleName || !allowed.has(roleName.toLowerCase())) {
            res.status(403).json({ message: "Insufficient permissions" });
            return;
        }

        next();
    };
};

export const requireSelfPayload = (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth;

    if (!auth) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    if (auth.roleName.toLowerCase() === "customer") {
        if (req.body.user_id && req.body.user_id !== auth.user.id) {
            res.status(403).json({ message: "Customers may only access their own records" });
            return;
        }

        req.body.user_id = auth.user.id;

        if (Array.isArray(req.body.reservations)) {
            req.body.reservations = req.body.reservations.map((reservation: Record<string, unknown>) => ({
                ...reservation,
                user_id: auth.user.id
            }));
        }
    }

    next();
};

export const scopeToAuthenticatedUser = (req: Request, _res: Response, next: NextFunction) => {
    if (req.auth?.roleName.toLowerCase() === "customer") {
        req.query.user_id = req.auth.user.id;
    }

    next();
};

export const requireOwnedRecord = (table: "reservation" | "combined_booking") => async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const auth = req.auth;

    if (!auth) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    if (auth.roleName.toLowerCase() !== "customer") {
        next();
        return;
    }

    try {
        const { data, error } = await getRequestSupabase(req)
            .from(table)
            .select("user_id")
            .eq(table === "reservation" ? "reservation_id" : "combined_booking_id", Number(req.params.id))
            .single();

        if (error || !data) {
            res.status(404).json({ message: `${table} not found` });
            return;
        }

        if (data.user_id !== auth.user.id) {
            res.status(403).json({ message: "Customers may only access their own records" });
            return;
        }

        next();
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: "Unable to verify record ownership" });
    }
};
