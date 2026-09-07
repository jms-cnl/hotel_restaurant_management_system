import { supabase } from "../config/supabase.js";

export const getReservations = async (filters: { status?: string | undefined; type?: string | undefined; combined_booking_id?: string | undefined; user_id?: string | undefined }) => {
    let query = supabase
        .from("reservation")
        .select("*, user(*), room(*), restaurant_table(*), combined_booking(*)");

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.type) {
        query = query.eq("reservation_type", filters.type);
    }

    if (filters.combined_booking_id) {
        query = query.eq("combined_booking_id", filters.combined_booking_id);
    }

    if (filters.user_id) {
        query = query.eq("user_id", filters.user_id);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getReservationById = async (id: number) => {
    const { data, error } = await supabase
        .from("reservation")
        .select("*, user(*), room(*), restaurant_table(*), combined_booking(*)")
        .eq("reservation_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createReservation = async (reservation: {
    user_id: string;
    reservation_type: string;
    room_id?: number;
    table_id?: number;
    check_in_date?: string;
    check_out_date?: string;
    reservation_date?: string;
    start_time?: string;
    end_time?: string;
    status: string;
    special_request?: string;
    combined_booking_id?: number | null;
}) => {
    const { data, error } = await supabase
        .from("reservation")
        .insert(reservation)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateReservation = async (
    id: number,
    reservation: {
        user_id?: string;
        reservation_type?: string;
        room_id?: number | null;
        table_id?: number | null;
        check_in_date?: string | null;
        check_out_date?: string | null;
        reservation_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        status?: string;
        special_request?: string | null;
        combined_booking_id?: number | null;
    }
) => {
    const { data, error } = await supabase
        .from("reservation")
        .update({
            ...reservation,
            updated_at: new Date().toISOString()
        })
        .eq("reservation_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteReservation = async (id: number) => {
    const { data, error } = await supabase
        .from("reservation")
        .update({
            status: "Cancelled",
            updated_at: new Date().toISOString()
        })
        .eq("reservation_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const changeReservationStatus = async (
    id: number,
    payload: {
        status: string;
        changed_by?: string;
        remarks?: string;
    }
) => {
    const { data, error } = await supabase
        .from("reservation")
        .update({
            status: payload.status,
            updated_at: new Date().toISOString()
        })
        .eq("reservation_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    const { error: historyError } = await supabase
        .from("reservation_status_history")
        .insert({
            reservation_id: id,
            changed_by: payload.changed_by,
            status: payload.status,
            remarks: payload.remarks
        });

    if (historyError) {
        throw historyError;
    }

    return data;
};

export const getReservationHistory = async (id: number) => {
    const { data, error } = await supabase
        .from("reservation_status_history")
        .select("*, user(*)")
        .eq("reservation_id", id)
        .order("changed_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
};
