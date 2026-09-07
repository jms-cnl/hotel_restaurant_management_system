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
            };
        }
    }
}

export {};
