import { supabase } from "../config/supabase.js";

export type NotificationMessage = {
    userId: string;
    reservationId: number;
    title: string;
    message: string;
    type: string;
};

export interface NotificationChannel {
    deliver(notification: NotificationMessage): Promise<void>;
}

export abstract class NotificationChannelCreator {
    abstract createChannel(): NotificationChannel;

    deliver(notification: NotificationMessage): Promise<void> {
        return this.createChannel().deliver(notification);
    }
}

export class InAppNotificationChannel implements NotificationChannel {
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

export class InAppNotificationCreator extends NotificationChannelCreator {
    createChannel(): NotificationChannel {
        return new InAppNotificationChannel();
    }
}
