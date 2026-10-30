import type { ApiError } from "./types";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
let csrfToken: string | null = null;
let csrfBootstrapPromise: Promise<string> | null = null;

const apiUrl = (path: string) => `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfBootstrapPaths = new Set(["/auth/csrf", "/auth/recovery/csrf"]);
const publicAuthPaths = new Set([
    "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/recovery/exchange"
]);

export const setCsrfToken = (token: string | null) => { csrfToken = token; };
export const clearCsrfToken = () => { csrfToken = null; };
export const getCsrfToken = () => csrfToken;

const setCsrfFromBody = (body: unknown) => {
    if (body && typeof body === "object" && "csrf_token" in body) {
        const token = (body as { csrf_token?: unknown }).csrf_token;
        if (typeof token === "string" && token) csrfToken = token;
    }
};

const parseResponse = async (response: Response) => {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text) as unknown; } catch { return text; }
};

const errorFromResponse = (response: Response, body: unknown) => {
    const message = typeof body === "object" && body && "message" in body
        ? String(body.message)
        : `Request failed (${response.status})`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    return error;
};

const notify = (name: string) => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
};

export async function bootstrapCsrfToken(path = "/auth/csrf"): Promise<string> {
    if (csrfToken) return csrfToken;
    if (csrfBootstrapPromise) return csrfBootstrapPromise;
    csrfBootstrapPromise = (async () => {
        const response = await fetch(apiUrl(path), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const body = await parseResponse(response);
        if (!response.ok) {
            if (response.status === 401) {
                clearCsrfToken();
                notify("hrms:session-expired");
            }
            throw errorFromResponse(response, body);
        }
        setCsrfFromBody(body);
        if (!csrfToken) throw new Error("The server did not provide a CSRF token");
        return csrfToken;
    })();
    try { return await csrfBootstrapPromise; }
    finally { csrfBootstrapPromise = null; }
}

const needsCsrf = (path: string, method: string) => {
    if (!stateChangingMethods.has(method)) return false;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return ![...csrfBootstrapPaths, ...publicAuthPaths].some((excluded) => normalizedPath === excluded);
};

const csrfBootstrapPathFor = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return normalizedPath === "/auth/reset-password" || normalizedPath.startsWith("/auth/recovery/")
        ? "/auth/recovery/csrf"
        : "/auth/csrf";
};

async function send(path: string, options: RequestInit, retryCsrf = true): Promise<Response> {
    const method = (options.method ?? "GET").toUpperCase();
    const headers = new Headers(options.headers);
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body !== undefined && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const includeCsrf = needsCsrf(path, method);
    if (includeCsrf) {
        if (!csrfToken) await bootstrapCsrfToken(csrfBootstrapPathFor(path));
        headers.set("X-CSRF-Token", csrfToken!);
    }

    const response = await fetch(apiUrl(path), { ...options, method, credentials: "include", headers });
    if (includeCsrf && retryCsrf && response.status === 403) {
        const body = await parseResponse(response.clone());
        if (typeof body === "object" && body && "message" in body
            && String(body.message) === "Invalid or missing CSRF token") {
            csrfToken = null;
            await bootstrapCsrfToken(csrfBootstrapPathFor(path));
            return send(path, options, false);
        }
    }
    return response;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await send(path, options);
    const body = await parseResponse(response);
    if (!response.ok) {
        if (response.status === 401) {
            clearCsrfToken();
            notify("hrms:session-expired");
        }
        throw errorFromResponse(response, body);
    }
    setCsrfFromBody(body);
    const method = (options.method ?? "GET").toUpperCase();
    if (stateChangingMethods.has(method) && !publicAuthPaths.has(path.startsWith("/") ? path : `/${path}`)
        && !csrfBootstrapPaths.has(path.startsWith("/") ? path : `/${path}`)) {
        notify("hrms:activity");
    }
    if (path === "/auth/logout" || path === "/auth/reset-password") clearCsrfToken();
    return body as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T = void>(path: string) => api<T>(path, { method: "DELETE" });
export const reportMeaningfulActivity = (recovery = false) =>
    apiPost<{ csrf_token: string }>(recovery ? "/auth/recovery/csrf" : "/auth/csrf", {});

export async function apiUpload<T>(path: string, file: File, fields: Record<string, string> = {}, method = "POST"): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return api<T>(path, { method, body: form });
}
