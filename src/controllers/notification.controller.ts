import type { Request, Response } from "express";
import { getNotifications, markNotificationAsRead } from "../services/notification.service.js";

export const getNotificationsController = async (req: Request, res: Response) => {
    try {
        const notifications = await getNotifications(req);

        res.json(notifications);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to retrieve notifications",
            error: error
        });
    }
};

export const markNotificationAsReadController = async (req: Request, res: Response) => {
    try {
        const notification = await markNotificationAsRead(req, Number(req.params.id));

        res.json(notification);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to mark notification as read",
            error: error
        });
    }
};
