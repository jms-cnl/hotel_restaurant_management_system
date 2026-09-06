import { supabase } from "../config/supabase.js";

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
    status: string;
}) => {
    const { data, error } = await supabase
        .from("hotel")
        .insert(hotel)
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
        status?: string;
    }
) => {
    const { data, error } = await supabase
        .from("hotel")
        .update(hotel)
        .eq("hotel_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteHotel = async (id: number) => {
    const { error } = await supabase
        .from("hotel")
        .delete()
        .eq("hotel_id", id);

    if (error) {
        throw error;
    }
};

