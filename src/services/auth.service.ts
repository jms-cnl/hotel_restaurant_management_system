import type { Request } from "express";
import { createSupabaseAuthClient, createUserScopedSupabase } from "../config/supabase.js";
import type { SessionMetadata } from "./session.service.js";
import { sessionService } from "./session.service.js";
import { assertPasswordPolicy } from "./password-policy.js";

type SafeProfile = { user_id: string; role_id: number; role_name: string };
export type IssuedAuthSession = {
    cookieSecret: string;
    csrfToken: string;
    user: { id: string; email: string | undefined };
    profile: SafeProfile;
    session: SessionMetadata;
};
export type AuthResult = { user: { id: string; email: string | undefined }; profile?: SafeProfile; session?: IssuedAuthSession };

const currentProfile = async (accessToken: string, userId: string): Promise<SafeProfile> => {
    const { data, error } = await createUserScopedSupabase(accessToken)
        .from("user").select("user_id, role_id, role(role_name)").eq("user_id", userId).single();
    const row = data as { user_id?: string; role_id?: number; role?: { role_name?: string } | Array<{ role_name?: string }> } | null;
    const role = Array.isArray(row?.role) ? row.role[0] : row?.role;
    if (error || !row?.user_id || typeof row.role_id !== "number" || !role?.role_name) {
        throw new Error("Authenticated user profile not found");
    }
    return { user_id: row.user_id, role_id: row.role_id, role_name: role.role_name };
};

const expiryFromAuthSession = (session: { expires_at?: number; expires_in?: number }, accessToken?: string) => {
    const expiry = typeof session.expires_at === "number"
        ? new Date(session.expires_at * 1000)
        : typeof session.expires_in === "number"
            ? new Date(Date.now() + session.expires_in * 1000)
            : new Date((readJwtClaims(accessToken ?? "").exp ?? 0) * 1000);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new Error("Auth session has expired");
    return expiry;
};

const issueSession = async (authSession: {
    access_token: string; refresh_token: string; expires_at?: number; expires_in?: number;
}, user: { id: string; email?: string }, purpose: "app" | "recovery"): Promise<IssuedAuthSession> => {
    const profile = await currentProfile(authSession.access_token, user.id);
    const input = {
        userId: user.id,
        roleName: profile.role_name,
        credentials: { accessToken: authSession.access_token, refreshToken: authSession.refresh_token },
        accessTokenExpiresAt: expiryFromAuthSession(authSession, authSession.access_token)
    };
    const issued = purpose === "app"
        ? await sessionService.createApplicationSession(input)
        : await sessionService.createRecoverySession(input);
    return {
        ...issued,
        user: { id: user.id, email: user.email },
        profile,
        session: issued.session
    };
};

export const registerUser = async (payload: {
    email: string; password: string; first_name: string; last_name: string; phone?: string;
}): Promise<AuthResult> => {
    assertPasswordPolicy(payload.password);
    const { data, error } = await createSupabaseAuthClient().auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: { first_name: payload.first_name, last_name: payload.last_name, phone: payload.phone } }
    });
    if (error) throw error;
    if (!data.user) throw new Error("User registration failed");
    const user = { id: data.user.id, email: data.user.email };
    if (!data.session) return { user };
    const session = await issueSession(data.session, data.user, "app");
    return { user, profile: session.profile, session };
};

export const loginUser = async (payload: { email: string; password: string }): Promise<AuthResult> => {
    const { data, error } = await createSupabaseAuthClient().auth.signInWithPassword(payload);
    if (error) throw error;
    if (!data.user || !data.session) throw new Error("Authentication did not return a session");
    const session = await issueSession(data.session, data.user, "app");
    return { user: session.user, profile: session.profile, session };
};

const isRecoveryToken = (token: string) => {
    const claims = readJwtClaims(token);
    return claims.amr?.some((entry) => typeof entry === "string" ? entry === "recovery" : entry.method === "recovery") ?? false;
};

const readJwtClaims = (token: string) => {
    try {
        const payload = token.split(".")[1];
        return payload ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
            exp?: number; amr?: Array<string | { method?: string }>;
        } : {};
    } catch { return {}; }
};

export const exchangeRecoveryTokens = async (tokens: { access_token: string; refresh_token: string }): Promise<IssuedAuthSession> => {
    if (!tokens.access_token || !tokens.refresh_token || !isRecoveryToken(tokens.access_token)) {
        throw new Error("Recovery link is invalid or expired");
    }
    const client = createUserScopedSupabase(tokens.access_token);
    const { data, error } = await client.auth.getUser(tokens.access_token);
    if (error || !data.user) throw new Error("Recovery link is invalid or expired");
    return issueSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }, data.user, "recovery");
};

export const requestPasswordReset = async (email: string) => {
    if (!email?.trim()) throw new Error("Email is required");
    const { error } = await createSupabaseAuthClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: process.env.FRONTEND_RESET_REDIRECT_URL ?? "http://localhost:5173/reset-password"
    });
    if (error) throw new Error("Unable to request password reset");
};

export const getSafeSessionStatus = async (req: Request) => {
    if (!req.auth) throw new Error("Authentication required");
    return {
        user: { id: req.auth.user.id, email: req.auth.user.email },
        profile: { ...req.auth.profile, role_name: req.auth.roleName },
        session: req.auth.sessionId ? {
            purpose: req.auth.sessionPurpose,
            scope: req.auth.sessionScope,
            last_activity_at: req.auth.sessionLastActivityAt
        } : null
    };
};

export const rotateSessionCsrf = async (req: Request) => {
    if (!req.auth?.sessionId) throw new Error("An HRMS session is required");
    const token = await sessionService.rotateCsrfToken(req.auth.sessionId);
    if (!token) throw new Error("Session is invalid or expired");
    return token;
};

export const changePassword = async (req: Request, currentPassword: string, newPassword: string) => {
    assertPasswordPolicy(newPassword);
    if (currentPassword === newPassword) throw new Error("New password must be different from the current password");
    if (!req.auth?.accessToken) throw new Error("Authenticated user could not be identified");
    const client = createUserScopedSupabase(req.auth.accessToken);
    const { data, error } = await client.auth.getUser(req.auth.accessToken);
    if (error || !data.user.email) throw new Error("Authenticated user could not be identified");
    const { error: verifyError } = await createSupabaseAuthClient().auth.signInWithPassword({ email: data.user.email, password: currentPassword });
    if (verifyError) throw new Error("Current password is incorrect");
    const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: process.env.SUPABASE_KEY!, Authorization: `Bearer ${req.auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
    });
    if (!response.ok) throw new Error("Failed to change password");
};

export const resetPassword = async (req: Request, newPassword: string) => {
    assertPasswordPolicy(newPassword);
    if (!req.auth?.accessToken || req.auth.sessionPurpose !== "recovery") throw new Error("Reset session is invalid or expired");
    const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: process.env.SUPABASE_KEY!, Authorization: `Bearer ${req.auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
    });
    if (!response.ok) throw new Error("Reset session is invalid or expired");
};

export const logoutUser = async (req: Request) => {
    if (req.auth?.sessionId) {
        const revoked = await sessionService.revokeCurrentSession(req.auth.sessionId);
        if (!revoked) throw new Error("Current session could not be revoked");
        return;
    }
    throw new Error("An HRMS browser session is required");
};
