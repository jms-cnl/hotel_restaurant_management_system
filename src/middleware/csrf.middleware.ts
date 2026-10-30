import type { NextFunction, Request, Response } from "express";
import { verifySessionCsrfToken } from "../services/session-crypto.js";
import { isAllowedOrigin } from "./cors.middleware.js";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const requireSessionCsrf = (req: Request, res: Response, next: NextFunction) => {
    if (!stateChangingMethods.has(req.method.toUpperCase())) {
        next();
        return;
    }

    const auth = req.auth;
    if (!auth) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    // Preserve the legacy bearer path until the frontend is migrated to cookie sessions.
    if (auth.authMethod === "legacy_bearer") {
        next();
        return;
    }

    const token = req.get("X-CSRF-Token") ?? "";
    if (!auth.csrfTokenHash || !verifySessionCsrfToken(auth.csrfTokenHash, token)) {
        res.status(403).json({ message: "Invalid or missing CSRF token" });
        return;
    }

    next();
};

export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("Origin");
    if (origin && isAllowedOrigin(origin)) {
        next();
        return;
    }
    res.status(403).json({ message: "Request origin is not allowed" });
};
