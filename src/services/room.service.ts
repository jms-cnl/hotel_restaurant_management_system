import { supabase } from "../config/supabase.js";
import { deleteMediaForEntity } from "./media.service.js";

export class RoomError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "RoomError";
    }
}

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
    status: string;
}) => {
    const { data, error } = await supabase
        .from("room")
        .insert(room)
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
        status?: string;
    }
) => {
    const validFields = new Set(["hotel_id", "room_number", "room_type", "capacity", "price_per_night", "status"]);
    const updateFields = Object.fromEntries(Object.entries(room).filter(([field]) => validFields.has(field)));
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
