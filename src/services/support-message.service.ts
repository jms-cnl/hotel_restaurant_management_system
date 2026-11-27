import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";
import {
    AdminInboxNotificationObserver,
    SupportMessageHistoryObserver,
    SupportMessageSubject,
    type SupportMessageStatus,
} from "./support-message-observer.js";

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

const messageFields = "support_message_id, customer_id, subject, message, status, created_at, updated_at";
const adminMessageFields = `${messageFields}, customer:user!support_message_customer_id_fkey(first_name,last_name,email)`;
const createSupportMessageSubject = (req: Request) => {
    const subject = new SupportMessageSubject();
    subject.attach(new SupportMessageHistoryObserver(req));
    subject.attach(new AdminInboxNotificationObserver(req));
    return subject;
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
    await createSupportMessageSubject(req).notify({
        type: "submitted",
        supportMessageId: data.support_message_id,
        actorId: customerId,
        newStatus: "open",
    });
    return data;
};

const parseSupportMessageId = (id: string) => {
    if (!/^\d+$/.test(id) || Number(id) < 1 || !Number.isSafeInteger(Number(id))) {
        throw new SupportMessageError("Invalid support message id");
    }
    return Number(id);
};
const throwOnMessageQueryError = (error: { code?: string } | null, notFound = false) => {
    if (!error) return;
    if (notFound && error.code === "PGRST116") throw new SupportMessageError("Support message not found", 404);
    throw new Error("Support message persistence failed");
};
export const listSupportMessages = async (req: Request) => {
    const { data, error } = await getRequestSupabase(req).from("support_message")
        .select(adminMessageFields).order("created_at", { ascending: false });
    throwOnMessageQueryError(error);
    return data ?? [];
};
export const getSupportMessage = async (req: Request, id: string) => {
    const messageId = parseSupportMessageId(id);
    const { data, error } = await getRequestSupabase(req).from("support_message")
        .select(adminMessageFields).eq("support_message_id", messageId).single();
    throwOnMessageQueryError(error, true);
    if (!data) throw new SupportMessageError("Support message not found", 404);
    return data;
};
export const updateSupportMessageStatus = async (req: Request, id: string, status: unknown) => {
    const messageId = parseSupportMessageId(id);
    if (status !== "open" && status !== "resolved") throw new SupportMessageError("Status must be open or resolved");
    const client = getRequestSupabase(req);
    const current = await client.from("support_message").select(adminMessageFields)
        .eq("support_message_id", messageId).single();
    throwOnMessageQueryError(current.error, true);
    if (!current.data) throw new SupportMessageError("Support message not found", 404);
    if (current.data.status === status) return current.data;
    const { data, error } = await client.from("support_message").update({
        status,
        updated_at: new Date().toISOString(),
    }).eq("support_message_id", messageId).eq("status", current.data.status)
        .select(adminMessageFields).single();
    throwOnMessageQueryError(error, true);
    if (!data) throw new SupportMessageError("Support message not found", 404);

    await createSupportMessageSubject(req).notify({
        type: "status_changed",
        supportMessageId: messageId,
        actorId: req.auth!.user.id,
        previousStatus: current.data.status as SupportMessageStatus,
        newStatus: status,
    });
    return data;
};
