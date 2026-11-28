import { supabase } from "../config/supabase.js";
import { canonicalizeStatus, TABLE_STATUSES } from "../constants/status.js";
import { deleteMediaForEntity } from "./media.service.js";

export class TableError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "TableError";
    }
}

const validateGracePeriod = (value: unknown) => {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 30) {
        throw new TableError("grace_period_minutes must be an integer between 0 and 30");
    }
    return value;
};

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
    grace_period_minutes?: number;
    status?: unknown;
}) => {
    const gracePeriod = validateGracePeriod(table.grace_period_minutes);
    const { grace_period_minutes: _gracePeriodMinutes, ...tableFields } = table;
    const normalizedTable = {
        ...tableFields,
        ...(gracePeriod === undefined ? {} : { grace_period_minutes: gracePeriod }),
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
        grace_period_minutes?: number;
        status?: unknown;
    }
) => {
    const gracePeriod = validateGracePeriod(table.grace_period_minutes);
    const validFields = new Set(["restaurant_id", "table_number", "capacity", "grace_period_minutes", "status"]);
    const updateFields = Object.fromEntries(Object.entries(table).filter(([field, value]) =>
        validFields.has(field) && !(field === "grace_period_minutes" && value === undefined)));
    if (gracePeriod !== undefined) updateFields.grace_period_minutes = gracePeriod;
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
