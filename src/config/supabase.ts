import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const getBearerToken = (req: Request) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        return null;
    }

    return header.slice("Bearer ".length);
};

export const getRequestSupabase = (req: Request) => {
    const token = getBearerToken(req);

    if (!token) {
        return supabase;
    }

    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
};
