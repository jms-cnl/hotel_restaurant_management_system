import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";
export type SupportMessageStatus = "open" | "resolved";
export type SupportMessageEvent =
    | { type: "submitted"; supportMessageId: number; actorId: string; newStatus: "open" }
    | { type: "status_changed"; supportMessageId: number; actorId: string; previousStatus: SupportMessageStatus; newStatus: SupportMessageStatus };
export interface SupportMessageObserver {
    update(event: SupportMessageEvent): void | Promise<void>;
}
export interface SupportMessageSubjectContract {
    attach(observer: SupportMessageObserver): void;
    detach(observer: SupportMessageObserver): void;
    notify(event: SupportMessageEvent): Promise<void>;
}
export class SupportMessageSubject implements SupportMessageSubjectContract {
    private readonly observers = new Set<SupportMessageObserver>();
    attach(observer: SupportMessageObserver) { this.observers.add(observer); }
    detach(observer: SupportMessageObserver) { this.observers.delete(observer); }
    async notify(event: SupportMessageEvent) {
        await Promise.all([...this.observers].map((observer) => observer.update(event)));
    }
}
export class SupportMessageHistoryObserver implements SupportMessageObserver {
    constructor(private readonly req: Request) {}
    async update(event: SupportMessageEvent) {
        const { error } = await getRequestSupabase(this.req).from("support_message_history").insert({
            support_message_id: event.supportMessageId,
            actor_user_id: event.actorId,
            event_type: event.type,
            previous_status: event.type === "submitted" ? null : event.previousStatus,
            new_status: event.newStatus,
        });
        if (error) throw new Error("Support message history persistence failed");
    }
}
export class AdminInboxNotificationObserver implements SupportMessageObserver {
    constructor(private readonly req: Request) {}
    async update(event: SupportMessageEvent) {
        if (event.type !== "status_changed") return;
        const { error } = await getRequestSupabase(this.req)
            .from("support_message_admin_notification")
            .update({ handled_at: event.newStatus === "resolved" ? new Date().toISOString() : null })
            .eq("support_message_id", event.supportMessageId);
        if (error) throw new Error("Admin inbox notification update failed");
    }
}
