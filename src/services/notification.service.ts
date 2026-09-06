import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";

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
    const client = getRequestSupabase(req);
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
        throw authError;
    }

    const { data, error } = await client
        .from("notification")
        .update({ is_read: true })
        .eq("notification_id", id)
        .eq("user_id", authData.user.id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};
