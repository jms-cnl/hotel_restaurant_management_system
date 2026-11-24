import type { Request } from "express";
import { getRequestSupabase, supabase } from "../config/supabase.js";
import { getAssignedRestaurantIds } from "../middleware/restaurant-access.middleware.js";

const getCount = async (client: typeof supabase, table: string, filters: Record<string, string> = {}, tableIds?: number[]) => {
    let query = client
        .from(table)
        .select("*", { count: "exact", head: true });

    for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column, value);
    }
    if (tableIds) query = query.in("table_id", tableIds);

    const { count, error } = await query;

    if (error) {
        throw error;
    }

    return count ?? 0;
};

const getReservationCount = async (client: typeof supabase, status?: string, type?: string, tableIds?: number[]) => {
    const filters: Record<string, string> = {};
    if (status) filters.status = status;
    if (type) filters.reservation_type = type;
    return getCount(client, "reservation", filters, tableIds);
};

export const getDashboardStats = async (req: Request) => {
    const client = getRequestSupabase(req);
    const isStaff = req.auth?.roleName.toLowerCase() === "staff";
    const assignedRestaurantIds = isStaff ? await getAssignedRestaurantIds(req) : undefined;
    const assignedTableIds = assignedRestaurantIds?.length
        ? await client.from("restaurant_table").select("table_id").in("restaurant_id", assignedRestaurantIds).then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []).map((table) => Number(table.table_id));
        })
        : assignedRestaurantIds ? [] : undefined;
    const reservationCount = (status?: string) => isStaff
        ? Promise.all([
            getReservationCount(client, status, "HOTEL"),
            assignedTableIds?.length ? getReservationCount(client, status, "RESTAURANT", assignedTableIds) : Promise.resolve(0)
        ]).then(([hotel, restaurant]) => hotel + restaurant)
        : getReservationCount(client, status);
    const tableCount = (status?: string) => isStaff
        ? assignedTableIds?.length ? getCount(client, "restaurant_table", status ? { status } : {}, assignedTableIds) : Promise.resolve(0)
        : getCount(client, "restaurant_table", status ? { status } : {});
    const restaurantCount = isStaff
        ? Promise.resolve(assignedRestaurantIds?.length ?? 0)
        : getCount(client, "restaurant");
    const [
        hotels,
        restaurants,
        rooms,
        availableRooms,
        reservedRooms,
        occupiedRooms,
        maintenanceRooms,
        tables,
        availableTables,
        reservedTables,
        occupiedTables,
        maintenanceTables,
        reservations,
        pendingReservations,
        confirmedReservations,
        cancelledReservations,
        combinedBookings,
        completedCombinedBookings,
        notifications,
        unreadNotifications
    ] = await Promise.all([
        getCount(client, "hotel"),
        restaurantCount,
        getCount(client, "room"),
        getCount(client, "room", { status: "Available" }),
        getCount(client, "room", { status: "Reserved" }),
        getCount(client, "room", { status: "Occupied" }),
        getCount(client, "room", { status: "Maintenance" }),
        tableCount(),
        tableCount("Available"),
        tableCount("Reserved"),
        tableCount("Occupied"),
        tableCount("Maintenance"),
        reservationCount(),
        reservationCount("Pending"),
        reservationCount("Confirmed"),
        reservationCount("Cancelled"),
        getCount(client, "combined_booking"),
        getCount(client, "combined_booking", { status: "Completed" }),
        getCount(client, "notification", { user_id: req.auth?.user.id ?? "" }),
        getCount(client, "notification", { user_id: req.auth?.user.id ?? "", is_read: "false" })
    ]);

    return {
        hotels,
        restaurants,
        rooms,
        availableRooms,
        reservedRooms,
        occupiedRooms,
        maintenanceRooms,
        tables,
        availableTables,
        reservedTables,
        occupiedTables,
        maintenanceTables,
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
