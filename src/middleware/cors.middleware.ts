import type { NextFunction, Request, Response } from "express";

export const parseAllowedOrigins = (configuration = process.env.CORS_ORIGINS ?? ""): Set<string> => {
    const origins = new Set<string>();
    for (const entry of configuration.split(",").map((value) => value.trim()).filter(Boolean)) {
        if (entry === "*") throw new Error("CORS_ORIGINS cannot contain wildcard origins when credentials are enabled");
        let parsed: URL;
        try { parsed = new URL(entry); }
        catch { throw new Error(`CORS_ORIGINS contains an invalid origin: ${entry}`); }
        if (!(["http:", "https:"].includes(parsed.protocol)
            && parsed.pathname === "/" && !parsed.search && !parsed.hash
            && entry.replace(/\/$/, "") === parsed.origin)) {
            throw new Error(`CORS_ORIGINS entries must be exact origins without paths: ${entry}`);
        }
        origins.add(parsed.origin);
    }
    return origins;
};

export const createCorsMiddleware = (allowedOrigins: ReadonlySet<string>) =>
    (req: Request, res: Response, next: NextFunction) => {
        const origin = req.get("Origin");
        if (!origin) {
            if (req.method.toUpperCase() === "OPTIONS") { res.sendStatus(204); return; }
            next();
            return;
        }

        res.vary("Origin");
        if (!allowedOrigins.has(origin)) {
            res.status(403).json({ message: "Request origin is not allowed" });
            return;
        }

        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        if (req.method.toUpperCase() === "OPTIONS") {
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-CSRF-Token");
            res.sendStatus(204);
            return;
        }
        next();
    };

export const isAllowedOrigin = (origin: string, configuration = process.env.CORS_ORIGINS ?? "") =>
    parseAllowedOrigins(configuration).has(origin);
