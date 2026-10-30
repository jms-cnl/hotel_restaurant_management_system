import { apiGet, apiPost, apiPut, bootstrapCsrfToken, clearCsrfToken, setCsrfToken } from "./api";
import type { User } from "./types";

type SessionStatus = {
    profile: { role_name: string };
    session: { last_activity_at: string } | null;
};
type SessionAuthResponse = {
    csrf_token: string | null;
    session: { idle_expires_at: string } | null;
};
type AuthApi = {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    put<T>(path: string, body: unknown): Promise<T>;
    bootstrap(path?: string): Promise<string>;
    setCsrf(token: string | null): void;
    clearCsrf(): void;
};

const defaultApi: AuthApi = {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    bootstrap: bootstrapCsrfToken,
    setCsrf: setCsrfToken,
    clearCsrf: clearCsrfToken
};
const timeoutForRole = (roleName: string) => roleName.toLowerCase() === "customer" ? 30 * 60_000 : 15 * 60_000;

export const createAuthSessionClient = (client: AuthApi = defaultApi) => ({
    async restore(): Promise<{ user: User; expiresAt: number }> {
        const status = await client.get<SessionStatus>("/auth/session");
        if (!status.session) throw new Error("No authenticated browser session");
        await client.bootstrap("/auth/csrf");
        const user = await client.get<User>("/users/me");
        return { user, expiresAt: Date.now() + timeoutForRole(status.profile.role_name) };
    },

    async login(email: string, password: string): Promise<{ user: User; expiresAt: number }> {
        const result = await client.post<SessionAuthResponse>("/auth/login", { email, password });
        if (!result.session || !result.csrf_token) throw new Error("Sign-in did not establish a browser session");
        client.setCsrf(result.csrf_token);
        const user = await client.get<User>("/users/me");
        return { user, expiresAt: Date.parse(result.session.idle_expires_at) };
    },

    async register(payload: Record<string, unknown>): Promise<{ authenticated: boolean; user: User | null; expiresAt: number | null }> {
        const result = await client.post<SessionAuthResponse>("/auth/register", payload);
        if (!result.session || !result.csrf_token) return { authenticated: false, user: null, expiresAt: null };
        client.setCsrf(result.csrf_token);
        const user = await client.get<User>("/users/me");
        return { authenticated: true, user, expiresAt: Date.parse(result.session.idle_expires_at) };
    },

    async logout(): Promise<void> {
        try { await client.post("/auth/logout", {}); }
        finally { client.clearCsrf(); }
    },

    async updateProfile(payload: Record<string, unknown>): Promise<User> {
        return client.put<User>("/users/me", payload);
    },

    async recover(tokens: { access_token: string; refresh_token: string } | null): Promise<{ profile: { role_name: string }; expiresAt: number }> {
        if (tokens) {
            const exchanged = await client.post<SessionAuthResponse>("/auth/recovery/exchange", tokens);
            if (!exchanged.session || !exchanged.csrf_token) throw new Error("Recovery session could not be established");
            client.setCsrf(exchanged.csrf_token);
        } else {
            await client.get("/auth/recovery/session");
            await client.bootstrap("/auth/recovery/csrf");
        }
        const status = await client.get<SessionStatus>("/auth/recovery/session");
        if (!status.session) throw new Error("Recovery session is invalid or expired");
        return { profile: status.profile, expiresAt: Date.now() + timeoutForRole(status.profile.role_name) };
    }
});

export const authSession = createAuthSessionClient();
