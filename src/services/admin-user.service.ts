import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";

export class AdminUserError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "AdminUserError";
    }
}

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isAssignableRole = (role: unknown): role is "Staff" | "Customer" => role === "Staff" || role === "Customer";

const roleNameOf = (role: unknown) => {
    const relation = Array.isArray(role) ? role[0] : role;
    return relation && typeof relation === "object" && "role_name" in relation && typeof relation.role_name === "string"
        ? relation.role_name
        : null;
};

export const getAdminUsers = async (req: Request) => {
    const { data, error } = await getRequestSupabase(req)
        .from("user")
        .select("user_id, first_name, last_name, email, role(role_name)");
    if (error) throw error;
    return (data ?? []).map((user) => ({
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: roleNameOf(user.role)
    }));
};

export const updateAdminUserRole = async (req: Request, userId: string, requestedRole: unknown) => {
    if (!USER_ID_PATTERN.test(userId)) throw new AdminUserError("Invalid user id");
    if (!isAssignableRole(requestedRole)) throw new AdminUserError("Invalid role");

    const client = getRequestSupabase(req);
    const { data: target, error: targetError } = await client
        .from("user")
        .select("user_id, role_id, role(role_name)")
        .eq("user_id", userId)
        .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new AdminUserError("User not found", 404);
    if (userId === req.auth?.user.id) throw new AdminUserError("Cannot change your own role");

    const currentRole = roleNameOf(target.role);
    if (currentRole === "Admin") throw new AdminUserError("Cannot change an Admin's role");
    if (currentRole === requestedRole) return { user_id: userId, role: requestedRole };

    const { data: role, error: roleError } = await client
        .from("role")
        .select("role_id")
        .eq("role_name", requestedRole)
        .maybeSingle();
    if (roleError) throw roleError;
    if (!role) throw new Error("Assignable role not found");

    const { error: updateError } = await client
        .from("user")
        .update({ role_id: role.role_id })
        .eq("user_id", userId)
        .select("user_id")
        .single();
    if (updateError) throw updateError;

    if (currentRole === "Staff" && requestedRole === "Customer") {
        const { error: assignmentCleanupError } = await client
            .from("staff_restaurant_assignment")
            .delete()
            .eq("user_id", userId);
        if (assignmentCleanupError) {
            console.error("Staff assignment cleanup failed after role demotion; leftover rows are inactive for non-Staff users");
        }
    }

    return { user_id: userId, role: requestedRole };
};
