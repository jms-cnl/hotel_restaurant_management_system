import type { Request } from "express";
import { getBearerToken, getRequestSupabase, supabase } from "../config/supabase.js";
import { assertPasswordPolicy } from "./password-policy.js";

export const registerUser = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
}) => {
    const { email, password, first_name, last_name, phone } = payload;
    assertPasswordPolicy(password);

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name,
                last_name,
                phone
            }
        }
    });

    if (authError) {
        throw authError;
    }

    if (!authData.user) {
        throw new Error("User registration failed");
    }

    return {
        user: authData.user,
        session: authData.session
    };
};

export const loginUser = async (payload: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword(payload);

    if (error) {
        throw error;
    }

    return data;
};

export const requestPasswordReset = async (email: string) => {
    if (!email?.trim()) throw new Error("Email is required");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: process.env.FRONTEND_RESET_REDIRECT_URL ?? "http://localhost:5173/reset-password"
    });

    if (error) throw new Error("Unable to request password reset");
};

export const changePassword = async (req: Request, currentPassword: string, newPassword: string) => {
    assertPasswordPolicy(newPassword);
    if (currentPassword === newPassword) throw new Error("New password must be different from the current password");

    const client = getRequestSupabase(req);
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user.email) throw new Error("Authenticated user could not be identified");

    const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authData.user.email,
        password: currentPassword
    });
    if (verifyError) throw new Error("Current password is incorrect");

    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error("Failed to change password");
};

export const resetPassword = async (req: Request, newPassword: string) => {
    assertPasswordPolicy(newPassword);
    const token = getBearerToken(req);
    if (!token) throw new Error("Reset session is invalid or expired");

    const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1/user`, {
        method: "PUT",
        headers: {
            apikey: process.env.SUPABASE_KEY!,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: newPassword })
    });

    if (!response.ok) throw new Error("Reset session is invalid or expired");
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
