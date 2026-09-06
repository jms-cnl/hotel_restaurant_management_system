import type { Request, Response } from "express";
import { getCurrentUserProfile, updateCurrentUserProfile } from "../services/user.service.js";

export const getCurrentUserController = async (req: Request, res: Response) => {
    try {
        const profile = await getCurrentUserProfile(req);

        res.json(profile);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to retrieve current user profile",
            error: error
        });
    }
};

export const updateCurrentUserController = async (req: Request, res: Response) => {
    try {
        const profile = await updateCurrentUserProfile(req, req.body);

        res.json(profile);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to update current user profile",
            error: error
        });
    }
};
