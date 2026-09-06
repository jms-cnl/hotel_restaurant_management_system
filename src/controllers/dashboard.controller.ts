import type { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service.js";

export const getDashboardController = async (_req: Request, res: Response) => {
    try {
        const dashboard = await getDashboardStats();

        res.json(dashboard);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve dashboard statistics",
            error: error
        });
    }
};
