import { supabase } from "../config/supabase.js";

export const REPORT_STATUSES = ["Pending", "Confirmed", "Rejected", "Cancelled", "Completed"] as const;
export type ReportFilters = {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    status?: string | undefined;
    type?: "HOTEL" | "RESTAURANT" | undefined;
    hotelId?: number | undefined;
    restaurantId?: number | undefined;
    roomId?: number | undefined;
    tableId?: number | undefined;
};

export class ReportError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "ReportError";
    }
}

const parseDate = (value: string | undefined, name: string) => {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ReportError(`${name} must use YYYY-MM-DD format`);
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ReportError(`${name} is invalid`);
    return value;
};

const parseId = (value: string | undefined, name: string) => {
    if (!value) return undefined;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new ReportError(`${name} must be a positive integer`);
    return id;
};

export const parseReportFilters = (query: Record<string, unknown>): ReportFilters => {
    const dateFrom = parseDate(query.date_from?.toString(), "date_from");
    const dateTo = parseDate(query.date_to?.toString(), "date_to");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ReportError("date_from must not be after date_to");
    const status = query.status?.toString();
    if (status && !REPORT_STATUSES.includes(status as typeof REPORT_STATUSES[number])) throw new ReportError("status is invalid");
    const rawType = query.type?.toString().toUpperCase();
    if (rawType && rawType !== "HOTEL" && rawType !== "RESTAURANT") throw new ReportError("type must be HOTEL or RESTAURANT");
    return {
        dateFrom,
        dateTo,
        status,
        type: rawType as ReportFilters["type"],
        hotelId: parseId(query.hotel_id?.toString(), "hotel_id"),
        restaurantId: parseId(query.restaurant_id?.toString(), "restaurant_id"),
        roomId: parseId(query.room_id?.toString(), "room_id"),
        tableId: parseId(query.table_id?.toString(), "table_id")
    };
};

const getRelatedIds = async (filters: ReportFilters) => {
    let roomIds: number[] | undefined;
    let tableIds: number[] | undefined;
    if (filters.hotelId !== undefined) {
        const { data, error } = await supabase.from("room").select("room_id").eq("hotel_id", filters.hotelId);
        if (error) throw error;
        roomIds = (data ?? []).map((room) => room.room_id);
    }
    if (filters.restaurantId !== undefined) {
        const { data, error } = await supabase.from("restaurant_table").select("table_id").eq("restaurant_id", filters.restaurantId);
        if (error) throw error;
        tableIds = (data ?? []).map((table) => table.table_id);
    }
    return { roomIds, tableIds };
};

const overlapsDateFilter = (reservation: Record<string, any>, filters: ReportFilters) => {
    if (reservation.reservation_type === "HOTEL") {
        if (filters.dateFrom && reservation.check_out_date && reservation.check_out_date <= filters.dateFrom) return false;
        if (filters.dateTo && reservation.check_in_date && reservation.check_in_date > filters.dateTo) return false;
        return true;
    }
    const reservationDate = reservation.reservation_date as string | null;
    return (!filters.dateFrom || Boolean(reservationDate && reservationDate >= filters.dateFrom)) &&
        (!filters.dateTo || Boolean(reservationDate && reservationDate <= filters.dateTo));
};

export const getReservationRows = async (filters: ReportFilters = {}) => {
    const relatedIds = await getRelatedIds(filters);
    if (relatedIds.roomIds?.length === 0 || relatedIds.tableIds?.length === 0) return [];
    let query = supabase.from("reservation")
        .select("*, user(*), room(*, hotel(*)), restaurant_table(*, restaurant(*)), combined_booking(*)")
        .order("created_at", { ascending: false });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.type) query = query.eq("reservation_type", filters.type);
    if (filters.roomId !== undefined) query = query.eq("room_id", filters.roomId);
    else if (relatedIds.roomIds) query = query.in("room_id", relatedIds.roomIds);
    if (filters.tableId !== undefined) query = query.eq("table_id", filters.tableId);
    else if (relatedIds.tableIds) query = query.in("table_id", relatedIds.tableIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).filter((reservation) => overlapsDateFilter(reservation, filters));
};

const summarize = (rows: any[]) => ({
    totalReservations: rows.length,
    hotelReservations: rows.filter((row) => row.reservation_type === "HOTEL").length,
    restaurantReservations: rows.filter((row) => row.reservation_type === "RESTAURANT").length,
    combinedChildReservations: rows.filter((row) => row.combined_booking_id !== null).length,
    statusBreakdown: Object.fromEntries(REPORT_STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length]))
});

export const getReservationReport = async (filters: ReportFilters = {}) => {
    const reservations = await getReservationRows(filters);
    return { summary: summarize(reservations), reservations };
};

export const getTableReport = async (filters: ReportFilters = {}) => {
    const reservations = await getReservationRows({ ...filters, type: "RESTAURANT", hotelId: undefined, roomId: undefined });
    return { summary: { totalTableReservations: reservations.length, statusBreakdown: summarize(reservations).statusBreakdown }, reservations };
};

const billableStatuses = new Set(["Confirmed", "Completed"]);

export const getRevenueReport = async (filters: ReportFilters = {}) => {
    const reservations = (await getReservationRows(filters)).filter((reservation) => billableStatuses.has(reservation.status));
    const hotelReservations = reservations.filter((reservation) => reservation.reservation_type === "HOTEL");
    const hotelRevenue = hotelReservations.reduce((total, reservation) => {
        const room = Array.isArray(reservation.room) ? reservation.room[0] : reservation.room;
        const price = Number(room?.price_per_night ?? 0);
        const checkIn = reservation.check_in_date ? new Date(reservation.check_in_date) : null;
        const checkOut = reservation.check_out_date ? new Date(reservation.check_out_date) : null;
        const nights = checkIn && checkOut ? Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000)) : 0;
        return total + price * nights;
    }, 0);
    return { totalRevenue: hotelRevenue, hotelRevenue, restaurantRevenue: 0, reservations };
};

export const getOccupancyReport = async (filters: ReportFilters = {}) => {
    const { data: rooms, error: roomsError } = await supabase.from("room").select("*, hotel(*)");
    if (roomsError) throw roomsError;
    const roomRows = (rooms ?? []).filter((room) => filters.hotelId === undefined || room.hotel_id === filters.hotelId)
        .filter((room) => filters.roomId === undefined || room.room_id === filters.roomId);
    const reservations = (await getReservationRows({ ...filters, type: "HOTEL", restaurantId: undefined, tableId: undefined }))
        .filter((reservation) => reservation.status === "Pending" || reservation.status === "Confirmed");
    const occupiedRoomIds = new Set(reservations.map((reservation) => reservation.room_id).filter(Boolean));
    const roomUtilization = roomRows.map((room) => ({
        room,
        occupied: occupiedRoomIds.has(room.room_id),
        reservations: reservations.filter((reservation) => reservation.room_id === room.room_id)
    }));
    const totalRooms = roomRows.length;
    return { totalRooms, occupiedRooms: occupiedRoomIds.size, availableRooms: Math.max(0, totalRooms - occupiedRoomIds.size), occupancyRate: totalRooms === 0 ? 0 : occupiedRoomIds.size / totalRooms, roomUtilization, reservations };
};
