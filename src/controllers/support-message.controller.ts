import type { Request, Response } from "express";
import {
    createSupportMessage,
    getSupportMessage,
    listSupportMessages,
    SupportMessageError,
    updateSupportMessageStatus,
} from "../services/support-message.service.js";

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

const sendSupportMessageError = (res: Response, error: unknown, fallback: string) => {
    if (error instanceof SupportMessageError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    res.status(500).json({ message: fallback });
};

export const listSupportMessagesController = async (req: Request, res: Response) => {
    try { res.json(await listSupportMessages(req)); }
    catch (error) { sendSupportMessageError(res, error, "Failed to load support messages"); }
};

export const getSupportMessageController = async (req: Request, res: Response) => {
    try { res.json(await getSupportMessage(req, typeof req.params.id === "string" ? req.params.id : "")); }
    catch (error) { sendSupportMessageError(res, error, "Failed to load support message"); }
};

export const updateSupportMessageStatusController = async (req: Request, res: Response) => {
    try { res.json(await updateSupportMessageStatus(req, typeof req.params.id === "string" ? req.params.id : "", req.body?.status)); }
    catch (error) { sendSupportMessageError(res, error, "Failed to update support message status"); }
};
