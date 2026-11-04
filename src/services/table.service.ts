import { supabase } from "../config/supabase.js";
import { canonicalizeStatus, TABLE_STATUSES } from "../constants/status.js";
import { deleteMediaForEntity } from "./media.service.js";

export class TableError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "TableError";
    }
}

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
    status?: unknown;
}) => {
    const normalizedTable = {
        ...table,
        status: canonicalizeStatus(table.status, "restaurant table", TABLE_STATUSES, "Available")
    };
    const { data, error } = await supabase
        .from("restaurant_table")
        .insert(normalizedTable)
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
        status?: unknown;
    }
) => {
    const validFields = new Set(["restaurant_id", "table_number", "capacity", "status"]);
    const updateFields = Object.fromEntries(Object.entries(table).filter(([field]) => validFields.has(field)));
    if (Object.hasOwn(updateFields, "status")) {
        if (updateFields.status === undefined) delete updateFields.status;
        else updateFields.status = canonicalizeStatus(updateFields.status, "restaurant table", TABLE_STATUSES, "Available");
    }
    if (Object.keys(updateFields).length === 0) throw new TableError("No valid fields to update");
    const { data, error } = await supabase
        .from("restaurant_table")
        .update(updateFields)
        .eq("table_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteTable = async (id: number) => {
    await deleteMediaForEntity("table", id);
    const { error } = await supabase
        .from("restaurant_table")
        .delete()
        .eq("table_id", id);

    if (error) {
        throw error;
    }
};
