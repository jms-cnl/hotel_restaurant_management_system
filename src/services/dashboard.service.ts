import { supabase } from "../config/supabase.js";

const getCount = async (table: string, filters: Record<string, string> = {}) => {
    let query = supabase
        .from(table)
        .select("*", { count: "exact", head: true });

    for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column, value);
    }

    const { count, error } = await query;

    if (error) {
        throw error;
    }

    return count ?? 0;
};

export const getDashboardStats = async () => {
    const [
        hotels,
        restaurants,
        rooms,
        availableRooms,
        tables,
        availableTables,
        reservations,
        pendingReservations,
        confirmedReservations,
        cancelledReservations,
        combinedBookings,
        completedCombinedBookings,
        notifications,
        unreadNotifications
    ] = await Promise.all([
        getCount("hotel"),
        getCount("restaurant"),
        getCount("room"),
        getCount("room", { status: "Available" }),
        getCount("restaurant_table"),
        getCount("restaurant_table", { status: "Available" }),
        getCount("reservation"),
        getCount("reservation", { status: "Pending" }),
        getCount("reservation", { status: "Confirmed" }),
        getCount("reservation", { status: "Cancelled" }),
        getCount("combined_booking"),
        getCount("combined_booking", { status: "Completed" }),
        getCount("notification"),
        getCount("notification", { is_read: "false" })
    ]);

    return {
        hotels,
        restaurants,
        rooms,
        availableRooms,
        tables,
        availableTables,
        reservations,
        pendingReservations,
        confirmedReservations,
        cancelledReservations,
        combinedBookings,
        completedCombinedBookings,
        notifications,
        unreadNotifications
    };
};
