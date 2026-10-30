import type { User } from "@supabase/supabase-js";

declare global {
    namespace Express {
        interface Request {
            auth?: {
                user: User;
                profile: {
                    user_id: string;
                    role_id: number;
                };
                roleName: string;
                /** Internal server-only token for user-scoped Supabase requests. Never serialize req.auth. */
                accessToken: string;
                authMethod: "session_cookie" | "legacy_bearer";
                sessionId?: string;
                sessionPurpose?: "app" | "recovery";
                sessionScope?: "application" | "password_reset";
                sessionLastActivityAt?: string;
                csrfTokenHash?: Buffer;
            };
        }
    }
}

export {};
