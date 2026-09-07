import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { AsyncLocalStorage } from "node:async_hooks";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const baseSupabase = createClient(supabaseUrl, supabaseKey);
const requestStorage = new AsyncLocalStorage<Request>();

export const runWithRequest = (req: Request, callback: () => void) => {
    requestStorage.run(req, callback);
};

export const supabase = new Proxy(baseSupabase, {
    get(target, property, receiver) {
        const req = requestStorage.getStore();
        const client = req?.headers.authorization ? getRequestSupabase(req) : target;
        const value = Reflect.get(client, property, receiver);

        return typeof value === "function" ? value.bind(client) : value;
    }
});

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
        return baseSupabase;
    }

    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
};
