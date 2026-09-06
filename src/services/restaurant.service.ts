import { supabase } from "../config/supabase.js";

export const getRestaurants = async (filters: { search?: string | undefined }) => {
    let query = supabase
        .from("restaurant")
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

export const getRestaurantById = async (id: number) => {
    const { data, error } = await supabase
        .from("restaurant")
        .select("*")
        .eq("restaurant_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createRestaurant = async (restaurant: {
    name: string;
    address: string;
    description?: string;
    contact_number: string;
    email?: string;
    status: string;
}) => {
    const { data, error } = await supabase
        .from("restaurant")
        .insert(restaurant)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateRestaurant = async (
    id: number,
    restaurant: {
        name?: string;
        address?: string;
        description?: string;
        contact_number?: string;
        email?: string;
        status?: string;
    }
) => {
    const { data, error } = await supabase
        .from("restaurant")
        .update(restaurant)
        .eq("restaurant_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteRestaurant = async (id: number) => {
    const { error } = await supabase
        .from("restaurant")
        .delete()
        .eq("restaurant_id", id);

    if (error) {
        throw error;
    }
};
