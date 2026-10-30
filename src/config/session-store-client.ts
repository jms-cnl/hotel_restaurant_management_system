import { createClient } from "@supabase/supabase-js";
import { isServiceRoleCredential } from "./session-config.js";

/**
 * Server-only client for public.hrm_sessions.
 * Import only from src/services/session-store.ts; never use for business data.
 */
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleCredential = process.env.SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL must be configured for the session store");
}

if (!serviceRoleCredential || !isServiceRoleCredential(serviceRoleCredential)) {
    throw new Error("SUPABASE_SESSION_STORE_SERVICE_ROLE_KEY must be a Supabase service-role credential");
}

const privilegedClient = createClient(supabaseUrl, serviceRoleCredential, {
    auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
    }
});

const fromSessionTable = (table: "hrm_sessions") => {
    if ((table as string) !== "hrm_sessions") {
        throw new Error("Session-store client can access only public.hrm_sessions");
    }

    return privilegedClient.from("hrm_sessions");
};

// Expose only the session-table query surface, never the raw service-role client.
export const sessionStoreClient = Object.freeze({ from: fromSessionTable });
