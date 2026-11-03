import type { Request, Response } from "express";
import { AdminUserError, getAdminUsers, updateAdminUserRole } from "../services/admin-user.service.js";

const sendError = (res: Response, error: unknown, fallback: string) => {
    console.error(error);
    if (error instanceof AdminUserError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    res.status(500).json({ message: fallback });
};

export const getAdminUsersController = async (req: Request, res: Response) => {
    try {
        res.json(await getAdminUsers(req));
    } catch (error) {
        sendError(res, error, "Failed to retrieve users");
    }
};

export const updateAdminUserRoleController = async (req: Request, res: Response) => {
    try {
        res.json(await updateAdminUserRole(req, String(req.params.userId ?? ""), req.body?.role));
    } catch (error) {
        sendError(res, error, "Failed to update user role");
    }
};
