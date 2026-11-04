import { supabase } from "../config/supabase.js";
import { createReservationNotification } from "./notification.service.js";

const BLOCKING_STATUSES = ["Pending", "Confirmed"];

export class ReservationError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "ReservationError";
    }
}

export type ReservationInput = {
    user_id: string;
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
    combined_booking_id?: number | null;
};

type ReservationRecord = ReservationInput & { reservation_id: number; created_at?: string; updated_at?: string };

export const isSupportedStatusTransition = (from: string, to: string) => {
    if (from === to) return false;
    return (from === "Pending" && (to === "Confirmed" || to === "Rejected" || to === "Cancelled")) ||
        (from === "Confirmed" && (to === "Completed" || to === "Cancelled"));
};

const isDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const isTime = (value: string) => /^\d{2}:\d{2}(:\d{2})?$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60;
const timeValue = (value: string) => value.length === 5 ? `${value}:00` : value;

const assertDateAndTimeRules = (reservation: ReservationInput) => {
    if (typeof reservation.reservation_type !== "string") throw new ReservationError("reservation_type is required");
    const type = reservation.reservation_type.toUpperCase();
    const hasRoom = reservation.room_id !== null && reservation.room_id !== undefined;
    const hasTable = reservation.table_id !== null && reservation.table_id !== undefined;

    if (type !== "HOTEL" && type !== "RESTAURANT") throw new ReservationError("reservation_type must be HOTEL or RESTAURANT");
    if (hasRoom === hasTable) throw new ReservationError("A reservation must reference exactly one room or table");

    if (type === "HOTEL") {
        if (!hasRoom || !reservation.check_in_date || !reservation.check_out_date) {
            throw new ReservationError("Hotel reservations require room_id, check_in_date, and check_out_date");
        }
        if (!isDate(reservation.check_in_date) || !isDate(reservation.check_out_date) || reservation.check_in_date >= reservation.check_out_date) {
            throw new ReservationError("Hotel check-in and check-out dates are invalid or out of order");
        }
        return;
    }

    if (!hasTable || !reservation.reservation_date || !reservation.start_time || !reservation.end_time) {
        throw new ReservationError("Restaurant reservations require table_id, reservation_date, start_time, and end_time");
    }
    if (!isDate(reservation.reservation_date) || !isTime(reservation.start_time) || !isTime(reservation.end_time) || timeValue(reservation.start_time) >= timeValue(reservation.end_time)) {
        throw new ReservationError("Restaurant reservation date or time range is invalid");
    }
};

const assertAvailability = async (reservation: ReservationInput, excludeId?: number) => {
    const type = reservation.reservation_type.toUpperCase();
    const resourceColumn = type === "HOTEL" ? "room_id" : "table_id";
    const resourceId = type === "HOTEL" ? reservation.room_id : reservation.table_id;
    let query = supabase.from("reservation")
        .select("reservation_id, check_in_date, check_out_date, reservation_date, start_time, end_time, status")
        .eq(resourceColumn, resourceId as number)
        .in("status", BLOCKING_STATUSES);

    if (excludeId !== undefined) query = query.neq("reservation_id", excludeId);
    const { data, error } = await query;
    if (error) throw error;

    const conflict = (data ?? []).some((existing) => type === "HOTEL"
        ? Boolean(reservation.check_in_date && reservation.check_out_date && existing.check_in_date && existing.check_out_date && reservation.check_in_date < existing.check_out_date && reservation.check_out_date > existing.check_in_date)
        : Boolean(reservation.reservation_date === existing.reservation_date && reservation.start_time && reservation.end_time && existing.start_time && existing.end_time && timeValue(reservation.start_time) < timeValue(existing.end_time) && timeValue(reservation.end_time) > timeValue(existing.start_time)));

    if (conflict) throw new ReservationError("The requested room or table is not available", 409);
};

export const validateReservation = async (reservation: ReservationInput, excludeId?: number, allowExistingStatus = false) => {
    if (!reservation.user_id) throw new ReservationError("user_id is required");
    assertDateAndTimeRules(reservation);
    if (!allowExistingStatus && reservation.status && reservation.status !== "Pending") throw new ReservationError("New reservations must start with Pending status");
    await assertAvailability(reservation, excludeId);
};

export const getReservations = async (filters: { status?: string | undefined; type?: string | undefined; combined_booking_id?: string | undefined; user_id?: string | undefined }) => {
    let query = supabase.from("reservation").select("*, user(*), room(*), restaurant_table(*), combined_booking(*)");
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.type) query = query.eq("reservation_type", filters.type);
    if (filters.combined_booking_id) query = query.eq("combined_booking_id", filters.combined_booking_id);
    if (filters.user_id) query = query.eq("user_id", filters.user_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const getReservationById = async (id: number) => {
    const { data, error } = await supabase.from("reservation").select("*, user(*), room(*), restaurant_table(*), combined_booking(*)").eq("reservation_id", id).single();
    if (error) throw error;
    return data;
};

export const createReservation = async (reservation: ReservationInput, changedBy = reservation.user_id) => {
    if (reservation.combined_booking_id !== undefined && reservation.combined_booking_id !== null) {
        throw new ReservationError("Reservations cannot be attached directly to a combined booking");
    }
    const normalized = { ...reservation, reservation_type: reservation.reservation_type.toUpperCase(), status: "Pending" };
    await validateReservation(normalized);
    const { data, error } = await supabase.from("reservation").insert(normalized).select().single();
    if (error?.code === "23P01") {
        throw new ReservationError("This room or table is already booked for that time.", 409);
    }
    if (error) throw error;

    const { error: historyError } = await supabase.from("reservation_status_history").insert({
        reservation_id: data.reservation_id,
        changed_by: changedBy,
        status: "Pending",
        remarks: "Reservation created"
    });
    if (historyError) {
        await supabase.from("reservation").delete().eq("reservation_id", data.reservation_id);
        throw historyError;
    }
    await createReservationNotification({ userId: data.user_id, reservationId: data.reservation_id, type: "RESERVATION_CREATED" });
    return data;
};

export const updateReservation = async (id: number, reservation: Partial<ReservationInput>) => {
    const { data: current, error: currentError } = await supabase.from("reservation").select("*").eq("reservation_id", id).single();
    if (currentError || !current) throw currentError ?? new ReservationError("Reservation not found", 404);
    if (Object.hasOwn(reservation, "combined_booking_id") && reservation.combined_booking_id !== current.combined_booking_id) {
        throw new ReservationError("Reservations cannot be attached to or moved between combined bookings");
    }
    if (current.combined_booking_id !== null && current.combined_booking_id !== undefined &&
        typeof reservation.reservation_type === "string" &&
        reservation.reservation_type.toUpperCase() !== String(current.reservation_type).toUpperCase()) {
        throw new ReservationError("A combined booking reservation cannot change type");
    }
    if (reservation.status && reservation.status !== current.status) throw new ReservationError("Use the status endpoint to change reservation status");

    const merged = { ...current, ...reservation, status: current.status } as ReservationRecord;
    await validateReservation(merged, id, true);
    const { data, error } = await supabase.from("reservation").update({ ...reservation, reservation_type: merged.reservation_type.toUpperCase(), updated_at: new Date().toISOString() }).eq("reservation_id", id).select().single();
    if (error) throw error;
    return data;
};

export const deleteReservation = async (id: number, changedBy: string) => changeReservationStatus(id, { status: "Cancelled", remarks: "Reservation cancelled" }, changedBy);

export const changeReservationStatus = async (id: number, payload: { status: string; remarks?: string }, changedBy: string) => {
    const { data: current, error: currentError } = await supabase.from("reservation").select("status").eq("reservation_id", id).single();
    if (currentError || !current) throw currentError ?? new ReservationError("Reservation not found", 404);
    if (!isSupportedStatusTransition(current.status, payload.status)) throw new ReservationError(`Invalid reservation status transition: ${current.status} to ${payload.status}`);

    const { data, error } = await supabase.from("reservation").update({ status: payload.status, updated_at: new Date().toISOString() }).eq("reservation_id", id).select().single();
    if (error) throw error;
    const { error: historyError } = await supabase.from("reservation_status_history").insert({ reservation_id: id, changed_by: changedBy, status: payload.status, remarks: payload.remarks });
    if (historyError) throw historyError;
    const notificationType = {
        Confirmed: "RESERVATION_CONFIRMED",
        Rejected: "RESERVATION_REJECTED",
        Cancelled: "RESERVATION_CANCELLED",
        Completed: "RESERVATION_COMPLETED"
    } as const;
    await createReservationNotification({
        userId: data.user_id,
        reservationId: data.reservation_id,
        type: notificationType[payload.status as keyof typeof notificationType]
    });
    return data;
};

export const getReservationHistory = async (id: number) => {
    const { data, error } = await supabase.from("reservation_status_history").select("*, user(*)").eq("reservation_id", id).order("changed_at", { ascending: false });
    if (error) throw error;
    return data;
};
