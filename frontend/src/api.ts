import type { ApiError } from "./types";

const tokenKey = "hrm_access_token";
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

const apiUrl = (path: string) => `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

export const getToken = () => localStorage.getItem(tokenKey);
export const setToken = (token: string | null) => token ? localStorage.setItem(tokenKey, token) : localStorage.removeItem(tokenKey);

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(apiUrl(path), { ...options, headers });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (!response.ok) {
        const message = typeof body === "object" && body && "message" in body ? String(body.message) : `Request failed (${response.status})`;
        const error = new Error(message) as ApiError;
        error.status = response.status;
        if (response.status === 401) setToken(null);
        throw error;
    }

    return body as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T = void>(path: string) => api<T>(path, { method: "DELETE" });

export async function apiUpload<T>(path: string, file: File, fields: Record<string, string> = {}, method = "POST"): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(apiUrl(path), { method, body: form, headers });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
        const message = typeof body === "object" && body && "message" in body ? String(body.message) : `Request failed (${response.status})`;
        const error = new Error(message) as ApiError;
        error.status = response.status;
        if (response.status === 401) setToken(null);
        throw error;
    }
    return body as T;
}
