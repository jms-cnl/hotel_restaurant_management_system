import { supabase } from "../config/supabase.js";

export const getReservationReport = async (filters: { status?: string | undefined; type?: string | undefined }) => {
    let query = supabase
        .from("reservation")
        .select("*, user(*), room(*), restaurant_table(*), combined_booking(*)")
        .order("created_at", { ascending: false });

    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    if (filters.type) {
        query = query.eq("reservation_type", filters.type);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getRevenueReport = async () => {
    const { data, error } = await supabase
        .from("reservation")
        .select("reservation_id, combined_booking_id, reservation_type, status, check_in_date, check_out_date, reservation_date, room(price_per_night)");

    if (error) {
        throw error;
    }

    const completed = (data ?? []).filter((reservation) => reservation.status !== "Cancelled");
    const hotelRevenue = completed.reduce((total, reservation) => {
        const room = Array.isArray(reservation.room) ? reservation.room[0] : reservation.room;
        const price = Number(room?.price_per_night ?? 0);
        const checkIn = reservation.check_in_date ? new Date(reservation.check_in_date) : null;
        const checkOut = reservation.check_out_date ? new Date(reservation.check_out_date) : null;
        const nights = checkIn && checkOut
            ? Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000))
            : 0;

        return total + price * nights;
    }, 0);

    return {
        totalRevenue: hotelRevenue,
        hotelRevenue,
        restaurantRevenue: 0,
        reservations: completed
    };
};

export const getOccupancyReport = async () => {
    const [{ data: rooms, error: roomsError }, { data: reservations, error: reservationsError }] = await Promise.all([
        supabase.from("room").select("*"),
        supabase.from("reservation").select("*").eq("reservation_type", "HOTEL")
    ]);

    if (roomsError) {
        throw roomsError;
    }

    if (reservationsError) {
        throw reservationsError;
    }

    const occupiedRooms = new Set(
        (reservations ?? [])
            .filter((reservation) => reservation.status !== "Cancelled" && reservation.room_id)
            .map((reservation) => reservation.room_id)
    ).size;
    const totalRooms = rooms?.length ?? 0;

    return {
        totalRooms,
        occupiedRooms,
        availableRooms: Math.max(0, totalRooms - occupiedRooms),
        occupancyRate: totalRooms === 0 ? 0 : occupiedRooms / totalRooms,
        reservations
    };
};
