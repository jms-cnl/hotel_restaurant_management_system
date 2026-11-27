import type { Request, Response } from "express";
import { createSupportMessage, SupportMessageError } from "../services/support-message.service.js";

export const submitSupportMessageController = async (req: Request, res: Response) => {
    try {
        const supportMessage = await createSupportMessage(req, req.body);
        res.status(201).json(supportMessage);
    } catch (error) {
        if (error instanceof SupportMessageError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        res.status(500).json({ message: "Failed to submit support message" });
    }
};
