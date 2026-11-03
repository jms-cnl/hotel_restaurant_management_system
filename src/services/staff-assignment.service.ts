import { getRequestSupabase } from "../config/supabase.js";
import type { Request } from "express";

export class StaffAssignmentError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "StaffAssignmentError";
    }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getStaffAssignments = async (req: Request) => {
    const { data, error } = await getRequestSupabase(req)
        .from("staff_restaurant_assignment")
        .select("*, user(first_name, last_name, email), restaurant(name)");
    if (error) throw error;
    return data;
};

export const createStaffAssignment = async (req: Request, payload: { user_id?: unknown; restaurant_id?: unknown }) => {
    if (typeof payload.user_id !== "string" || !UUID_PATTERN.test(payload.user_id)) {
        throw new StaffAssignmentError("user_id must be a valid UUID");
    }
    if (typeof payload.restaurant_id !== "number" || !Number.isInteger(payload.restaurant_id) || payload.restaurant_id <= 0) {
        throw new StaffAssignmentError("restaurant_id must be a positive integer");
    }

    const client = getRequestSupabase(req);
    const { data: user, error: userError } = await client.from("user").select("role(role_name)").eq("user_id", payload.user_id).maybeSingle();
    if (userError) throw userError;
    const roles = Array.isArray(user?.role) ? user.role : user?.role ? [user.role] : [];
    if (!roles.some((role) => role.role_name === "Staff")) throw new StaffAssignmentError("User is not Staff");

    const { data: restaurant, error: restaurantError } = await client.from("restaurant").select("restaurant_id").eq("restaurant_id", payload.restaurant_id).maybeSingle();
    if (restaurantError) throw restaurantError;
    if (!restaurant) throw new StaffAssignmentError("Restaurant does not exist");

    const { data, error } = await client.from("staff_restaurant_assignment")
        .insert({ user_id: payload.user_id, restaurant_id: payload.restaurant_id })
        .select()
        .single();
    if (error?.code === "23505") throw new StaffAssignmentError("Already assigned", 409);
    if (error) throw error;
    return data;
};

export const deleteStaffAssignment = async (req: Request, userId: string, restaurantIdValue: string) => {
    if (!UUID_PATTERN.test(userId)) throw new StaffAssignmentError("user_id must be a valid UUID");
    const restaurantId = Number(restaurantIdValue);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) throw new StaffAssignmentError("restaurant_id must be a positive integer");
    const { data, error } = await getRequestSupabase(req)
        .from("staff_restaurant_assignment")
        .delete()
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .select()
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new StaffAssignmentError("Assignment not found", 404);
    return data;
};
