import type { NextFunction, Request, Response } from "express";
import { RestaurantAccessError, assertRestaurantAccess } from "./restaurant-access.middleware.js";

export const restaurantAmenityAccess = async (req: Request, res: Response, next: NextFunction) => {
    const rawId = req.params.restaurantId;
    const restaurantId = typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;
    try {
        await assertRestaurantAccess(req, restaurantId);
        next();
    } catch (error) {
        if (error instanceof RestaurantAccessError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: "Unable to verify restaurant access" });
    }
};
