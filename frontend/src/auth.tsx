import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { apiGet, clearCsrfToken, reportMeaningfulActivity } from "./api";
import { authSession } from "./auth-session";
import type { User } from "./types";
type AuthContextValue = {
    user: User | null;
    loading: boolean;
    error: string;
    sessionWarning: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (payload: Record<string, unknown>) => Promise<boolean>;
    logout: () => Promise<void>;
    updateProfile: (payload: Record<string, unknown>) => Promise<void>;
};
type SessionStatus = { profile: { role_name: string }; session: { last_activity_at: string } | null };

const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sessionWarning, setSessionWarning] = useState(false);
    const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        const expireLocalSession = () => {
            clearCsrfToken();
            setUser(null);
            setSessionExpiresAt(null);
            setSessionWarning(false);
        };
        const onExpired = () => expireLocalSession();
        window.addEventListener("hrms:session-expired", onExpired);

        const restore = async () => {
            try {
                const restored = await authSession.restore();
                if (!active) return;
                setUser(restored.user);
                setSessionExpiresAt(restored.expiresAt);
                setSessionWarning(false);
            } catch {
                if (active) expireLocalSession();
            } finally {
                if (active) setLoading(false);
            }
        };
        void restore();
        return () => {
            active = false;
            window.removeEventListener("hrms:session-expired", onExpired);
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        let lastReportedAt = 0;
        let requestPending = false;
        const onMeaningfulActivity = () => {
            setSessionExpiresAt(Date.now() + ((user.role?.role_name ?? "Customer").toLowerCase() === "customer" ? 30 : 15) * 60_000);
            setSessionWarning(false);
        };
        const onUserInput = () => {
            const now = Date.now();
            if (requestPending || now - lastReportedAt < 60_000) return;
            requestPending = true;
            lastReportedAt = now;
            void reportMeaningfulActivity().then(() => onMeaningfulActivity()).catch(() => undefined).finally(() => { requestPending = false; });
        };
        window.addEventListener("hrms:activity", onMeaningfulActivity);
        window.addEventListener("pointerdown", onUserInput, { passive: true });
        window.addEventListener("keydown", onUserInput);
        window.addEventListener("touchstart", onUserInput, { passive: true });
        window.addEventListener("wheel", onUserInput, { passive: true });
        return () => {
            window.removeEventListener("hrms:activity", onMeaningfulActivity);
            window.removeEventListener("pointerdown", onUserInput);
            window.removeEventListener("keydown", onUserInput);
            window.removeEventListener("touchstart", onUserInput);
            window.removeEventListener("wheel", onUserInput);
        };
    }, [user]);

    useEffect(() => {
        if (!user || sessionExpiresAt === null) return;
        const warningTimer = window.setTimeout(
            () => setSessionWarning(true),
            Math.max(0, sessionExpiresAt - Date.now() - 2 * 60_000)
        );
        const expiryTimer = window.setTimeout(() => {
            void apiGet<SessionStatus>("/auth/session").then((status) => {
                if (!status.session) throw new Error("Session expired");
                const duration = status.profile.role_name.toLowerCase() === "customer" ? 30 : 15;
                const serverExpiry = Date.parse(status.session.last_activity_at) + duration * 60_000;
                if (serverExpiry <= Date.now()) throw new Error("Session expired");
                setSessionExpiresAt(serverExpiry);
                setSessionWarning(false);
            }).catch(() => {
                clearCsrfToken();
                setUser(null);
                setSessionExpiresAt(null);
                setSessionWarning(false);
            });
        }, Math.max(0, sessionExpiresAt - Date.now()));
        return () => { window.clearTimeout(warningTimer); window.clearTimeout(expiryTimer); };
    }, [user, sessionExpiresAt]);

    const login = async (email: string, password: string) => {
        setError("");
        const result = await authSession.login(email, password);
        setUser(result.user);
        setSessionExpiresAt(result.expiresAt);
        setSessionWarning(false);
    };

    const register = async (payload: Record<string, unknown>) => {
        setError("");
        const result = await authSession.register(payload);
        if (!result.authenticated || !result.user || result.expiresAt === null) return false;
        setUser(result.user);
        setSessionExpiresAt(result.expiresAt);
        setSessionWarning(false);
        return true;
    };

    const logout = async () => {
        try { await authSession.logout(); }
        finally {
            clearCsrfToken();
            setUser(null);
            setSessionExpiresAt(null);
            setSessionWarning(false);
        }
    };

    const updateProfile = async (payload: Record<string, unknown>) => setUser(await authSession.updateProfile(payload));
    const value = useMemo(() => ({ user, loading, error, sessionWarning, login, register, logout, updateProfile }), [user, loading, error, sessionWarning]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};
