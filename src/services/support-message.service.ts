import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";

const SUBJECT_MAX_LENGTH = 120;
const MESSAGE_MAX_LENGTH = 5000;

export class SupportMessageError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "SupportMessageError";
    }
}

type SupportMessageInput = { subject: string; message: string };

const validateInput = (input: unknown): SupportMessageInput => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new SupportMessageError("Support message must be an object");
    }

    const fields = input as Record<string, unknown>;
    const unexpected = Object.keys(fields).filter((key) => key !== "subject" && key !== "message");
    if (unexpected.length > 0) {
        throw new SupportMessageError("Support message contains fields that are not allowed");
    }
    if (typeof fields.subject !== "string" || fields.subject.trim().length === 0) {
        throw new SupportMessageError("Subject is required");
    }
    if (fields.subject.trim().length > SUBJECT_MAX_LENGTH) {
        throw new SupportMessageError("Subject must be 120 characters or fewer");
    }
    if (typeof fields.message !== "string" || fields.message.trim().length === 0) {
        throw new SupportMessageError("Message is required");
    }
    if (fields.message.trim().length > MESSAGE_MAX_LENGTH) {
        throw new SupportMessageError("Message must be 5000 characters or fewer");
    }

    return { subject: fields.subject.trim(), message: fields.message.trim() };
};

export const createSupportMessage = async (req: Request, input: unknown) => {
    const customerId = req.auth?.user.id;
    if (!customerId) throw new SupportMessageError("Authentication required", 401);

    const { subject, message } = validateInput(input);
    const client = getRequestSupabase(req);
    const { data, error } = await client.from("support_message").insert({
        customer_id: customerId,
        subject,
        message,
        status: "open"
    }).select("support_message_id, customer_id, subject, message, status, created_at, updated_at").single();

    if (error || !data) throw new Error("Support message persistence failed");
    return data;
};
