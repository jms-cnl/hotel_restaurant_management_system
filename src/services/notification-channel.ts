import { supabase } from "../config/supabase.js";
import { createEmailSender, type EmailMessage, type EmailSender } from "./email-sender.js";
import {
    combinedBookingConfirmedTemplate,
    reservationCreatedTemplate,
    reservationStatusChangedTemplate,
    supportMessageResolvedTemplate,
} from "./email-templates.js";

export type NotificationMessage = {
    userId: string;
    reservationId: number;
    title: string;
    message: string;
    type: string;
};

export type NotificationChannelResult = { providerMessageId?: string } | void;

export interface NotificationChannel<TNotification = NotificationMessage> {
    deliver(notification: TNotification): Promise<NotificationChannelResult>;
}

export abstract class NotificationChannelCreator<TNotification = NotificationMessage> {
    abstract createChannel(): NotificationChannel<TNotification>;

    deliver(notification: TNotification): Promise<NotificationChannelResult> {
        return this.createChannel().deliver(notification);
    }
}

export class InAppNotificationChannel implements NotificationChannel<NotificationMessage> {
    constructor(
        private readonly insert: (notification: NotificationMessage) => Promise<{ error: { code?: string } | null }> = async (notification) => {
            const { userId, reservationId, title, message, type } = notification;
            return await supabase.from("notification").insert({
                user_id: userId,
                reservation_id: reservationId,
                title,
                message,
                type,
                is_read: false,
            });
        },
    ) {}

    async deliver(notification: NotificationMessage): Promise<void> {
        const { reservationId, type } = notification;
        try {
            const { error } = await this.insert(notification);

            if (error) {
                console.error("Reservation notification creation failed", { reservationId, type, errorCode: error.code });
            }
        } catch {
            console.error("Reservation notification creation failed", { reservationId, type });
        }
    }
}

export class InAppNotificationCreator extends NotificationChannelCreator<NotificationMessage> {
    createChannel(): NotificationChannel<NotificationMessage> {
        return new InAppNotificationChannel();
    }
}

export type EmailNotification =
    | { type: "RESERVATION_CREATED"; to: string; bookingId: string | number }
    | { type: "RESERVATION_STATUS_CHANGED"; to: string; bookingId: string | number; status: "confirmed" | "cancelled" }
    | { type: "COMBINED_BOOKING_CONFIRMED"; to: string; bookingId: string | number }
    | { type: "SUPPORT_MESSAGE_RESOLVED"; to: string; supportMessageId: string | number };

export class EmailNotificationChannel implements NotificationChannel<EmailNotification> {
    constructor(private readonly sender: EmailSender) {}

    async deliver(notification: EmailNotification): Promise<NotificationChannelResult> {
        let template: Omit<EmailMessage, "to">;
        switch (notification.type) {
            case "RESERVATION_CREATED":
                template = reservationCreatedTemplate({ bookingId: notification.bookingId });
                break;
            case "RESERVATION_STATUS_CHANGED":
                template = reservationStatusChangedTemplate({ bookingId: notification.bookingId, status: notification.status });
                break;
            case "COMBINED_BOOKING_CONFIRMED":
                template = combinedBookingConfirmedTemplate({ bookingId: notification.bookingId });
                break;
            case "SUPPORT_MESSAGE_RESOLVED":
                template = supportMessageResolvedTemplate({ supportMessageId: notification.supportMessageId });
                break;
        }

        return this.sender.send({ to: notification.to, ...template });
    }
}

export class EmailNotificationCreator extends NotificationChannelCreator<EmailNotification> {
    constructor(private readonly sender: EmailSender = createEmailSender()) {
        super();
    }

    createChannel(): NotificationChannel<EmailNotification> {
        return new EmailNotificationChannel(this.sender);
    }
}
