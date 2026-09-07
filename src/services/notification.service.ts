import type { Request } from "express";
import { supabase } from "../config/supabase.js";
import { getRequestSupabase } from "../config/supabase.js";

export type ReservationNotificationType =
    | "RESERVATION_CREATED"
    | "RESERVATION_CONFIRMED"
    | "RESERVATION_REJECTED"
    | "RESERVATION_CANCELLED"
    | "RESERVATION_COMPLETED";

type ReservationNotificationEvent = {
    userId: string;
    reservationId: number;
    type: ReservationNotificationType;
};

export class NotificationError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "NotificationError";
    }
}

const notificationContent: Record<ReservationNotificationType, { title: string; message: string }> = {
    RESERVATION_CREATED: { title: "Reservation created", message: "Your reservation has been created and is pending confirmation." },
    RESERVATION_CONFIRMED: { title: "Reservation confirmed", message: "Your reservation has been confirmed." },
    RESERVATION_REJECTED: { title: "Reservation rejected", message: "Your reservation has been rejected." },
    RESERVATION_CANCELLED: { title: "Reservation cancelled", message: "Your reservation has been cancelled." },
    RESERVATION_COMPLETED: { title: "Reservation completed", message: "Your reservation has been completed." }
};

export const createReservationNotification = async ({ userId, reservationId, type }: ReservationNotificationEvent) => {
    const content = notificationContent[type];
    try {
        const { error } = await supabase.from("notification").insert({
            user_id: userId,
            reservation_id: reservationId,
            title: content.title,
            message: content.message,
            type,
            is_read: false
        });

        if (error) {
            console.error("Reservation notification creation failed", { reservationId, type, errorCode: error.code });
        }
    } catch {
        console.error("Reservation notification creation failed", { reservationId, type });
    }
};

export const getNotifications = async (req: Request) => {
    const client = getRequestSupabase(req);
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
        throw authError;
    }

    const { data, error } = await client
        .from("notification")
        .select("*, reservation(*)")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
};

export const markNotificationAsRead = async (req: Request, id: number) => {
    if (!Number.isInteger(id) || id <= 0) {
        throw new NotificationError("Invalid notification ID", 400);
    }
    const userId = req.auth?.user.id;
    if (!userId) {
        throw new NotificationError("Authentication required", 401);
    }
    const client = getRequestSupabase(req);
    const { data, error } = await client
        .from("notification")
        .update({ is_read: true })
        .eq("notification_id", id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data) {
        throw new NotificationError("Notification not found", 404);
    }

    return data;
};
