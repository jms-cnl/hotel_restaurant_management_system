import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";

export const getCurrentUserProfile = async (req: Request) => {
    const client = getRequestSupabase(req);
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
        throw authError;
    }

    const { data, error } = await client
        .from("user")
        .select("*, role(*)")
        .eq("user_id", authData.user.id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateCurrentUserProfile = async (
    req: Request,
    profile: {
        first_name?: string;
        last_name?: string;
        phone?: string;
        email?: string;
    }
) => {
    const client = getRequestSupabase(req);
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
        throw authError;
    }

    const { data, error } = await client
        .from("user")
        .update(profile)
        .eq("user_id", authData.user.id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};
