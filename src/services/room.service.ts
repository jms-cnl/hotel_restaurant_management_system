import { supabase } from "../config/supabase.js";
import { canonicalizeStatus, ROOM_STATUSES } from "../constants/status.js";
import { deleteMediaForEntity } from "./media.service.js";

export class RoomError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "RoomError";
    }
}

const validateGracePeriod = (value: unknown) => {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1440) {
        throw new RoomError("grace_period_minutes must be an integer between 0 and 1440");
    }
    return value;
};

export const getRooms = async (filters: { status?: string | undefined }) => {
    let query = supabase
        .from("room")
        .select("*, hotel(*)");

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getRoomById = async (id: number) => {
    const { data, error } = await supabase
        .from("room")
        .select("*, hotel(*)")
        .eq("room_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createRoom = async (room: {
    hotel_id: number;
    room_number: string;
    room_type: string;
    capacity: number;
    price_per_night: number;
    grace_period_minutes?: number;
    status?: unknown;
}) => {
    const gracePeriod = validateGracePeriod(room.grace_period_minutes);
    const { grace_period_minutes: _gracePeriodMinutes, ...roomFields } = room;
    const normalizedRoom = {
        ...roomFields,
        ...(gracePeriod === undefined ? {} : { grace_period_minutes: gracePeriod }),
        status: canonicalizeStatus(room.status, "room", ROOM_STATUSES, "Available")
    };
    const { data, error } = await supabase
        .from("room")
        .insert(normalizedRoom)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateRoom = async (
    id: number,
    room: {
        hotel_id?: number;
        room_number?: string;
        room_type?: string;
        capacity?: number;
        price_per_night?: number;
        grace_period_minutes?: number;
        status?: unknown;
    }
) => {
    const gracePeriod = validateGracePeriod(room.grace_period_minutes);
    const validFields = new Set(["hotel_id", "room_number", "room_type", "capacity", "price_per_night", "grace_period_minutes", "status"]);
    const updateFields = Object.fromEntries(Object.entries(room).filter(([field, value]) =>
        validFields.has(field) && !(field === "grace_period_minutes" && value === undefined)));
    if (gracePeriod !== undefined) updateFields.grace_period_minutes = gracePeriod;
    if (Object.hasOwn(updateFields, "status")) {
        if (updateFields.status === undefined) delete updateFields.status;
        else updateFields.status = canonicalizeStatus(updateFields.status, "room", ROOM_STATUSES, "Available");
    }
    if (Object.keys(updateFields).length === 0) throw new RoomError("No valid fields to update");
    const { data, error } = await supabase
        .from("room")
        .update(updateFields)
        .eq("room_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteRoom = async (id: number) => {
    await deleteMediaForEntity("room", id);
    const { error } = await supabase
        .from("room")
        .delete()
        .eq("room_id", id);

    if (error) {
        throw error;
    }
};
