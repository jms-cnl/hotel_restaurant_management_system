import { supabase } from "../config/supabase.js";
import { canonicalizeStatus, HOTEL_STATUSES } from "../constants/status.js";
import { deleteMediaForEntity } from "./media.service.js";

export class HotelError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "HotelError";
    }
}

export const getHotels = async (filters: { search?: string | undefined }) => {
    let query = supabase
        .from("hotel")
        .select("*");

    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getHotelById = async (id: number) => {
    const { data, error } = await supabase
        .from("hotel")
        .select("*")
        .eq("hotel_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createHotel = async (hotel: {
    name: string;
    address: string;
    description?: string;
    contact_number: string;
    email?: string;
    status?: unknown;
}) => {
    const normalizedHotel = {
        ...hotel,
        status: canonicalizeStatus(hotel.status, "hotel", HOTEL_STATUSES, "Active")
    };
    const { data, error } = await supabase
        .from("hotel")
        .insert(normalizedHotel)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateHotel = async (
    id: number,
    hotel: {
        name?: string;
        address?: string;
        description?: string;
        contact_number?: string;
        email?: string;
        status?: unknown;
    }
) => {
    const validFields = new Set(["name", "address", "description", "contact_number", "email", "status"]);
    const updateFields = Object.fromEntries(Object.entries(hotel).filter(([field]) => validFields.has(field)));
    if (Object.hasOwn(updateFields, "status")) {
        if (updateFields.status === undefined) delete updateFields.status;
        else updateFields.status = canonicalizeStatus(updateFields.status, "hotel", HOTEL_STATUSES, "Active");
    }
    if (Object.keys(updateFields).length === 0) throw new HotelError("No valid fields to update");
    const { data, error } = await supabase
        .from("hotel")
        .update(updateFields)
        .eq("hotel_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteHotel = async (id: number) => {
    await deleteMediaForEntity("hotel", id);
    const { error } = await supabase
        .from("hotel")
        .delete()
        .eq("hotel_id", id);

    if (error) {
        throw error;
    }
};

