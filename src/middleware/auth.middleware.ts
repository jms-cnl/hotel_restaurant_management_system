import type { NextFunction, Request, Response } from "express";
import { getBearerToken, getRequestSupabase, runWithRequest } from "../config/supabase.js";

type RoleRecord = { role_name?: string };

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);

    if (!token) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    try {
        const client = getRequestSupabase(req);
        const { data, error } = await client.auth.getUser(token);

        if (error || !data.user) {
            res.status(401).json({ message: "Invalid or expired access token" });
            return;
        }

        const { data: profile, error: profileError } = await client
            .from("user")
            .select("user_id, role_id, role(role_name)")
            .eq("user_id", data.user.id)
            .single();

        if (profileError || !profile) {
            res.status(401).json({ message: "Authenticated user profile not found" });
            return;
        }

        const role = Array.isArray(profile.role) ? profile.role[0] as RoleRecord | undefined : profile.role as RoleRecord | null;

        if (!role?.role_name) {
            res.status(403).json({ message: "Authenticated user has no application role" });
            return;
        }

        req.auth = {
            user: data.user,
            profile: {
                user_id: profile.user_id as string,
                role_id: profile.role_id as number
            },
            roleName: role.role_name
        };

        runWithRequest(req, next);
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: "Authentication failed" });
    }
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
