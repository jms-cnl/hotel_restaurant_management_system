import type { Request, Response } from "express";
import { getNotifications, markNotificationAsRead, NotificationError } from "../services/notification.service.js";

const handleNotificationError = (res: Response, error: unknown, message: string) => {
    if (error instanceof NotificationError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    console.error(error);
    res.status(500).json({ message });
};

export const getNotificationsController = async (req: Request, res: Response) => {
    try {
        const notifications = await getNotifications(req);

        res.json(notifications);
    } catch (error) {
        handleNotificationError(res, error, "Failed to retrieve notifications");
    }
};

export const markNotificationAsReadController = async (req: Request, res: Response) => {
    try {
        const notification = await markNotificationAsRead(req, Number(req.params.id));

        res.json(notification);
    } catch (error) {
        handleNotificationError(res, error, "Failed to mark notification as read");
    }
};
