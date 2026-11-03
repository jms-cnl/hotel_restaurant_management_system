import { supabase } from "../config/supabase.js";
import {
    isSupportedStatusTransition,
    ReservationError,
    validateReservation,
    type ReservationInput
} from "./reservation.service.js";
import { createReservationNotification } from "./notification.service.js";

type CombinedReservationInput = Omit<ReservationInput, "user_id"> & { user_id?: string };

export const getCombinedBookings = async (filters: { status?: string | undefined; user_id?: string | undefined }) => {
    let query = supabase.from("combined_booking").select("*, user(*), reservation(*)").order("created_at", { ascending: false });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.user_id) query = query.eq("user_id", filters.user_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const getCombinedBookingById = async (id: number) => {
    const { data, error } = await supabase.from("combined_booking").select("*, user(*), reservation(*)").eq("combined_booking_id", id).single();
    if (error) throw error;
    return data;
};

export const getCombinedBookingReservations = async (id: number) => {
    const { data, error } = await supabase.from("reservation").select("*, room(*), restaurant_table(*)").eq("combined_booking_id", id).order("created_at", { ascending: true });
    if (error) throw error;
    return data;
};

const validateCombinedChildren = async (userId: string, children: unknown) => {
    if (!Array.isArray(children) || children.length !== 2) {
        throw new ReservationError("A combined booking must contain exactly one HOTEL and one RESTAURANT reservation");
    }
    const childTypes = children.map((reservation: unknown) =>
        reservation && typeof reservation === "object" && "reservation_type" in reservation && typeof reservation.reservation_type === "string"
            ? reservation.reservation_type.toUpperCase()
            : ""
    );
    if (childTypes.filter((type: string) => type === "HOTEL").length !== 1 ||
        childTypes.filter((type: string) => type === "RESTAURANT").length !== 1) {
        throw new ReservationError("A combined booking must contain exactly one HOTEL and one RESTAURANT reservation");
    }
    if (!userId) throw new ReservationError("user_id is required");

    const normalized = (children as CombinedReservationInput[]).map((reservation) => ({
        ...reservation,
        user_id: reservation.user_id ?? userId,
        reservation_type: reservation.reservation_type.toUpperCase(),
        status: "Pending"
    })) as ReservationInput[];

    for (const reservation of normalized) await validateReservation(reservation);

    const hotelReservation = normalized.find((reservation) => reservation.reservation_type === "HOTEL");
    const restaurantReservation = normalized.find((reservation) => reservation.reservation_type === "RESTAURANT");
    const mismatchMessage = "Room and table must belong to the same hotel";
    if (!hotelReservation?.room_id || !restaurantReservation?.table_id) throw new ReservationError(mismatchMessage);

    const { data: rooms, error: roomError } = await supabase.from("room").select("hotel_id").eq("room_id", hotelReservation.room_id);
    if (roomError) throw roomError;
    const { data: tables, error: tableError } = await supabase.from("restaurant_table").select("restaurant_id").eq("table_id", restaurantReservation.table_id);
    if (tableError) throw tableError;
    const restaurantId = tables?.[0]?.restaurant_id;
    const { data: restaurants, error: restaurantError } = restaurantId
        ? await supabase.from("restaurant").select("hotel_id").eq("restaurant_id", restaurantId)
        : { data: null, error: null };
    if (restaurantError) throw restaurantError;
    const roomHotelId = rooms?.[0]?.hotel_id;
    const restaurantHotelId = restaurants?.[0]?.hotel_id;
    if (roomHotelId === null || roomHotelId === undefined || restaurantHotelId === null || restaurantHotelId === undefined || roomHotelId !== restaurantHotelId) {
        throw new ReservationError(mismatchMessage);
    }

    for (let index = 0; index < normalized.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
            const left = normalized[index];
            const right = normalized[otherIndex];
            if (!left || !right) continue;
            const sameRoom = left.room_id !== null && left.room_id !== undefined && left.room_id === right.room_id;
            const sameTable = left.table_id !== null && left.table_id !== undefined && left.table_id === right.table_id;
            const hotelConflict = sameRoom && left.check_in_date && left.check_out_date && right.check_in_date && right.check_out_date && left.check_in_date < right.check_out_date && left.check_out_date > right.check_in_date;
            const restaurantConflict = sameTable && left.reservation_date === right.reservation_date && left.start_time && left.end_time && right.start_time && right.end_time && left.start_time < right.end_time && left.end_time > right.start_time;
            if (hotelConflict || restaurantConflict) throw new ReservationError("Combined booking contains overlapping reservations", 409);
        }
    }
    return normalized;
};

export const createCombinedBooking = async (payload: {
    user_id: string;
    status?: string;
    reservations?: CombinedReservationInput[];
}, changedBy = payload.user_id) => {
    if (payload.status && payload.status !== "Pending") throw new ReservationError("New combined bookings must start with Pending status");
    const validatedReservations = await validateCombinedChildren(payload.user_id, payload.reservations ?? []);
    const reservations = validatedReservations.map((reservation) => ({
        reservation_type: reservation.reservation_type,
        room_id: reservation.room_id ?? null,
        table_id: reservation.table_id ?? null,
        check_in_date: reservation.check_in_date ?? null,
        check_out_date: reservation.check_out_date ?? null,
        reservation_date: reservation.reservation_date ?? null,
        start_time: reservation.start_time ?? null,
        end_time: reservation.end_time ?? null,
        special_request: reservation.special_request ?? null
    }));
    const { data: combinedBooking, error } = await supabase.rpc("create_combined_booking", {
        p_reservations: reservations
    });
    if (error) {
        if (error.code === "22023") throw new ReservationError(error.message, 400);
        if (error.code === "42501") throw new ReservationError(error.message, 403);
        throw error;
    }
    if (!combinedBooking || !Array.isArray(combinedBooking.reservations)) {
        throw new Error("Combined booking RPC returned an invalid result");
    }
    const createdReservations = combinedBooking.reservations as Array<{ user_id: string; reservation_id: number }>;

    await Promise.all(createdReservations.map((reservation) => createReservationNotification({
        userId: reservation.user_id,
        reservationId: reservation.reservation_id,
        type: "RESERVATION_CREATED"
    })));

    return { ...combinedBooking, reservations: createdReservations };
};

export const createHotelRestaurantCombinedBooking = async (payload: {
    user_id: string;
    status?: string;
    hotel_reservation: Omit<CombinedReservationInput, "reservation_type" | "table_id" | "user_id" | "status">;
    restaurant_reservation: Omit<CombinedReservationInput, "reservation_type" | "room_id" | "user_id" | "status">;
}, changedBy = payload.user_id) => createCombinedBooking({
    user_id: payload.user_id,
    ...(payload.status ? { status: payload.status } : {}),
    reservations: [
        { ...payload.hotel_reservation, reservation_type: "HOTEL", table_id: null },
        { ...payload.restaurant_reservation, reservation_type: "RESTAURANT", room_id: null }
    ]
}, changedBy);

export const updateCombinedBooking = async (id: number, combinedBooking: { user_id?: string; status?: string }, changedBy: string) => {
    if (combinedBooking.status) {
        await changeCombinedBookingStatus(id, { status: combinedBooking.status }, changedBy);
    }

    const update = { ...combinedBooking };
    delete update.status;
    if (Object.keys(update).length === 0) return getCombinedBookingById(id);

    const { data, error } = await supabase.from("combined_booking").update(update).eq("combined_booking_id", id).select().single();
    if (error) throw error;
    return data;
};

export const deleteCombinedBooking = async (id: number, changedBy: string) => changeCombinedBookingStatus(id, { status: "Cancelled", remarks: "Combined booking cancelled" }, changedBy);

export const changeCombinedBookingStatus = async (id: number, payload: { status: string; remarks?: string }, changedBy: string) => {
    const { data: current, error: currentError } = await supabase.from("combined_booking").select("status").eq("combined_booking_id", id).single();
    if (currentError || !current) throw currentError ?? new ReservationError("Combined booking not found", 404);
    if (!isSupportedStatusTransition(current.status, payload.status)) throw new ReservationError(`Invalid combined booking status transition: ${current.status} to ${payload.status}`);

    const { data: children, error: childrenError } = await supabase.from("reservation").select("reservation_id, user_id, status").eq("combined_booking_id", id);
    if (childrenError) throw childrenError;
    for (const child of children ?? []) {
        if (!isSupportedStatusTransition(child.status, payload.status)) throw new ReservationError(`Child reservation cannot transition from ${child.status} to ${payload.status}`);
    }

    const { data, error } = await supabase.from("combined_booking").update({ status: payload.status }).eq("combined_booking_id", id).select().single();
    if (error) throw error;

    if (children?.length) {
        const childIds = children.map((child) => child.reservation_id);
        const { error: childUpdateError } = await supabase.from("reservation").update({ status: payload.status, updated_at: new Date().toISOString() }).in("reservation_id", childIds);
        if (childUpdateError) throw childUpdateError;
        const { error: historyError } = await supabase.from("reservation_status_history").insert(children.map((child) => ({
            reservation_id: child.reservation_id,
            changed_by: changedBy,
            status: payload.status,
            remarks: payload.remarks ?? "Status changed through combined booking"
        })));
        if (historyError) throw historyError;
        const notificationType = {
            Confirmed: "RESERVATION_CONFIRMED",
            Rejected: "RESERVATION_REJECTED",
            Cancelled: "RESERVATION_CANCELLED",
            Completed: "RESERVATION_COMPLETED"
        } as const;
        await Promise.all(children.map((child) => createReservationNotification({
            userId: child.user_id,
            reservationId: child.reservation_id,
            type: notificationType[payload.status as keyof typeof notificationType]
        })));
    }

    return data;
};
