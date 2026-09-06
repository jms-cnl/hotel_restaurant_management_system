import type { Request } from "express";
import { getBearerToken, getRequestSupabase, supabase } from "../config/supabase.js";

export const registerUser = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role_id: number;
}) => {
    const { email, password, first_name, last_name, phone, role_id } = payload;
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });

    if (authError) {
        throw authError;
    }

    if (!authData.user) {
        return authData;
    }

    const { data: profile, error: profileError } = await supabase
        .from("user")
        .insert({
            user_id: authData.user.id,
            role_id,
            first_name,
            last_name,
            email,
            phone
        })
        .select()
        .single();

    if (profileError) {
        throw profileError;
    }

    return {
        user: authData.user,
        session: authData.session,
        profile
    };
};

export const loginUser = async (payload: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword(payload);

    if (error) {
        throw error;
    }

    return data;
};

export const logoutUser = async (req: Request) => {
    const token = getBearerToken(req);

    if (!token) {
        throw new Error("Missing bearer token");
    }

    const client = getRequestSupabase(req);
    const { error } = await client.auth.signOut();

    if (error) {
        throw error;
    }
};
