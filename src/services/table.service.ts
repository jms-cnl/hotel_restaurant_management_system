import { supabase } from "../config/supabase.js";

export const getTables = async (filters: { status?: string | undefined }) => {
    let query = supabase
        .from("restaurant_table")
        .select("*, restaurant(*)");

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getTableById = async (id: number) => {
    const { data, error } = await supabase
        .from("restaurant_table")
        .select("*, restaurant(*)")
        .eq("table_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createTable = async (table: {
    restaurant_id: number;
    table_number: string;
    capacity: number;
    status: string;
}) => {
    const { data, error } = await supabase
        .from("restaurant_table")
        .insert(table)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateTable = async (
    id: number,
    table: {
        restaurant_id?: number;
        table_number?: string;
        capacity?: number;
        status?: string;
    }
) => {
    const { data, error } = await supabase
        .from("restaurant_table")
        .update(table)
        .eq("table_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteTable = async (id: number) => {
    const { error } = await supabase
        .from("restaurant_table")
        .delete()
        .eq("table_id", id);

    if (error) {
        throw error;
    }
};
