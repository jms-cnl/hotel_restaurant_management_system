import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { apiGet, apiPost, apiPut, getToken, setToken } from "./api";
import type { User } from "./types";

type AuthContextValue = {
    user: User | null;
    loading: boolean;
    error: string;
    login: (email: string, password: string) => Promise<void>;
    register: (payload: Record<string, unknown>) => Promise<void>;
    logout: () => Promise<void>;
    updateProfile: (payload: Record<string, unknown>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(Boolean(getToken()));
    const [error, setError] = useState("");

    useEffect(() => {
        if (!getToken()) return;
        apiGet<User>("/users/me").then(setUser).catch(() => { setToken(null); setUser(null); }).finally(() => setLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        setError("");
        const result = await apiPost<{ session?: { access_token?: string } | null }>("/auth/login", { email, password });
        if (!result.session?.access_token) throw new Error("Login succeeded without an access token. Check email confirmation settings.");
        setToken(result.session.access_token);
        setUser(await apiGet<User>("/users/me"));
    };

    const register = async (payload: Record<string, unknown>) => {
        setError("");
        const result = await apiPost<{ session?: { access_token?: string } | null }>("/auth/register", payload);
        if (result.session?.access_token) {
            setToken(result.session.access_token);
            setUser(await apiGet<User>("/users/me"));
        }
    };

    const logout = async () => {
        try { await apiPost("/auth/logout", {}); } finally { setToken(null); setUser(null); }
    };

    const updateProfile = async (payload: Record<string, unknown>) => setUser(await apiPut<User>("/users/me", payload));

    const value = useMemo(() => ({ user, loading, error, login, register, logout, updateProfile }), [user, loading, error]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};
