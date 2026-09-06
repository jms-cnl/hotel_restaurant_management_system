import { supabase } from "../config/supabase.js";

type ReservationInput = {
    user_id?: string;
    reservation_type: string;
    room_id?: number | null;
    table_id?: number | null;
    check_in_date?: string | null;
    check_out_date?: string | null;
    reservation_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    status?: string;
    special_request?: string | null;
};

export const getCombinedBookings = async (filters: { status?: string | undefined; user_id?: string | undefined }) => {
    let query = supabase
        .from("combined_booking")
        .select("*, user(*), reservation(*)")
        .order("created_at", { ascending: false });

    if (filters.status) {
        query = query.eq("status", filters.status);
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

export const getCombinedBookingById = async (id: number) => {
    const { data, error } = await supabase
        .from("combined_booking")
        .select("*, user(*), reservation(*)")
        .eq("combined_booking_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const getCombinedBookingReservations = async (id: number) => {
    const { data, error } = await supabase
        .from("reservation")
        .select("*, room(*), restaurant_table(*)")
        .eq("combined_booking_id", id)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
};

export const createCombinedBooking = async (payload: {
    user_id: string;
    status?: string | undefined;
    reservations?: ReservationInput[];
}) => {
    const { data: combinedBooking, error: combinedBookingError } = await supabase
        .from("combined_booking")
        .insert({
            user_id: payload.user_id,
            status: payload.status ?? "Pending"
        })
        .select()
        .single();

    if (combinedBookingError) {
        throw combinedBookingError;
    }

    if (!payload.reservations?.length) {
        return combinedBooking;
    }

    const reservations = payload.reservations.map((reservation) => ({
        ...reservation,
        user_id: reservation.user_id ?? payload.user_id,
        status: reservation.status ?? payload.status ?? "Pending",
        combined_booking_id: combinedBooking.combined_booking_id
    }));

    const { data, error } = await supabase
        .from("reservation")
        .insert(reservations)
        .select();

    if (error) {
        await supabase
            .from("combined_booking")
            .delete()
            .eq("combined_booking_id", combinedBooking.combined_booking_id);

        throw error;
    }

    return {
        ...combinedBooking,
        reservations: data
    };
};

export const createHotelRestaurantCombinedBooking = async (payload: {
    user_id: string;
    status?: string | undefined;
    hotel_reservation: Omit<ReservationInput, "reservation_type" | "table_id" | "user_id" | "status">;
    restaurant_reservation: Omit<ReservationInput, "reservation_type" | "room_id" | "user_id" | "status">;
}) => {
    return createCombinedBooking({
        user_id: payload.user_id,
        status: payload.status,
        reservations: [
            {
                ...payload.hotel_reservation,
                user_id: payload.user_id,
                reservation_type: "HOTEL",
                table_id: null,
                status: payload.status ?? "Pending"
            },
            {
                ...payload.restaurant_reservation,
                user_id: payload.user_id,
                reservation_type: "RESTAURANT",
                room_id: null,
                status: payload.status ?? "Pending"
            }
        ]
    });
};

export const updateCombinedBooking = async (
    id: number,
    combinedBooking: {
        user_id?: string;
        status?: string;
    }
) => {
    if (combinedBooking.status === "Completed") {
        await completeCombinedBookingReservations(id);
    }

    const { data, error } = await supabase
        .from("combined_booking")
        .update(combinedBooking)
        .eq("combined_booking_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteCombinedBooking = async (id: number) => {
    const { error } = await supabase
        .from("combined_booking")
        .delete()
        .eq("combined_booking_id", id);

    if (error) {
        throw error;
    }
};

export const changeCombinedBookingStatus = async (
    id: number,
    payload: {
        status: string;
        changed_by?: string;
        remarks?: string;
    }
) => {
    if (payload.status === "Completed") {
        await completeCombinedBookingReservations(id, payload.changed_by, payload.remarks);
    }

    const { data, error } = await supabase
        .from("combined_booking")
        .update({ status: payload.status })
        .eq("combined_booking_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const completeCombinedBookingReservations = async (
    combinedBookingId: number,
    changedBy?: string,
    remarks?: string
) => {
    const { data: reservations, error: reservationsError } = await supabase
        .from("reservation")
        .update({
            status: "Completed",
            updated_at: new Date().toISOString()
        })
        .eq("combined_booking_id", combinedBookingId)
        .select("reservation_id");

    if (reservationsError) {
        throw reservationsError;
    }

    if (!reservations?.length) {
        return;
    }

    const { error: historyError } = await supabase
        .from("reservation_status_history")
        .insert(reservations.map((reservation) => ({
            reservation_id: reservation.reservation_id,
            changed_by: changedBy,
            status: "Completed",
            remarks: remarks ?? "Completed through combined booking status update"
        })));

    if (historyError) {
        throw historyError;
    }
};
