import type { NextFunction, Request, Response } from "express";
import { getRequestSupabase } from "../config/supabase.js";

export class RestaurantAccessError extends Error {
    constructor(message: string, public readonly statusCode = 403) {
        super(message);
        this.name = "RestaurantAccessError";
    }
}

type RestaurantIdResolver = (req: Request) => Promise<number[]>;

const userScopedClient = (req: Request) => getRequestSupabase(req);

export const assertRestaurantAccess = async (req: Request, restaurantId: number) => {
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        throw new RestaurantAccessError("Invalid restaurant id", 400);
    }

    const roleName = req.auth?.roleName.toLowerCase();
    if (roleName === "admin") return;
    if (roleName !== "staff") {
        throw new RestaurantAccessError("Not assigned to this restaurant");
    }

    const userId = req.auth?.user.id;
    if (!userId) throw new RestaurantAccessError("Not assigned to this restaurant");
    const { data, error } = await userScopedClient(req)
        .from("staff_restaurant_assignment")
        .select("restaurant_id")
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    if (!data) throw new RestaurantAccessError("Not assigned to this restaurant");
};

export const getAssignedRestaurantIds = async (req: Request) => {
    const userId = req.auth?.user.id;
    if (!userId) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    const { data, error } = await userScopedClient(req)
        .from("staff_restaurant_assignment")
        .select("restaurant_id")
        .eq("user_id", userId);
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    return (data ?? []).map((assignment) => Number(assignment.restaurant_id));
};

export const requireRestaurantAccess = (resolveRestaurantIds: RestaurantIdResolver) => {
    const restaurantAccessGuard = async (req: Request, res: Response, next: NextFunction) => {
        const roleName = req.auth?.roleName.toLowerCase();
        if (roleName !== "staff") {
            next();
            return;
        }

        try {
            const restaurantIds = await resolveRestaurantIds(req);
            for (const restaurantId of new Set(restaurantIds)) await assertRestaurantAccess(req, restaurantId);
            next();
        } catch (error) {
            const accessError = error instanceof RestaurantAccessError
                ? error
                : new RestaurantAccessError("Unable to verify restaurant access", 500);
            res.status(accessError.statusCode).json({ message: accessError.message });
        }
    };
    return restaurantAccessGuard;
};

const positiveId = (value: unknown, fieldName: string) => {
    const id = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (!Number.isInteger(id) || id <= 0) throw new RestaurantAccessError(`${fieldName} must be a positive integer`, 400);
    return id;
};

const restaurantIdForTable = async (req: Request, tableIdValue: unknown) => {
    const tableId = positiveId(tableIdValue, "table_id");
    const { data, error } = await userScopedClient(req)
        .from("restaurant_table")
        .select("restaurant_id")
        .eq("table_id", tableId)
        .maybeSingle();
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    if (!data) throw new RestaurantAccessError("Table not found", 404);
    return Number(data.restaurant_id);
};

export const restaurantIdFromParam = (param: string) => (req: Request) => Promise.resolve([
    positiveId(req.params[param], param === "id" ? "restaurant_id" : param)
]);

export const restaurantIdFromTableBody: RestaurantIdResolver = async (req) => [
    positiveId(req.body.restaurant_id, "restaurant_id")
];

export const restaurantIdsFromTableRecord: RestaurantIdResolver = async (req) => [
    await restaurantIdForTable(req, req.params.id)
];

export const restaurantIdsFromTableUpdate: RestaurantIdResolver = async (req) => {
    const currentRestaurantId = await restaurantIdForTable(req, req.params.id);
    const restaurantIds = [currentRestaurantId];
    if (Object.hasOwn(req.body, "restaurant_id")) {
        restaurantIds.push(positiveId(req.body.restaurant_id, "restaurant_id"));
    }
    return restaurantIds;
};

const restaurantIdForReservation = async (req: Request, reservationIdValue: unknown) => {
    const reservationId = positiveId(reservationIdValue, "reservation_id");
    const { data, error } = await userScopedClient(req)
        .from("reservation")
        .select("reservation_type, table_id")
        .eq("reservation_id", reservationId)
        .maybeSingle();
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    if (!data) throw new RestaurantAccessError("Reservation not found", 404);
    if (String(data.reservation_type).toUpperCase() !== "RESTAURANT") return null;
    return restaurantIdForTable(req, data.table_id);
};

export const restaurantIdsFromReservationRecord: RestaurantIdResolver = async (req) => {
    const restaurantId = await restaurantIdForReservation(req, req.params.id);
    return restaurantId === null ? [] : [restaurantId];
};

export const restaurantIdsFromReservationUpdate: RestaurantIdResolver = async (req) => {
    const currentId = positiveId(req.params.id, "reservation_id");
    const { data: current, error } = await userScopedClient(req)
        .from("reservation")
        .select("reservation_type, table_id")
        .eq("reservation_id", currentId)
        .maybeSingle();
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    if (!current) throw new RestaurantAccessError("Reservation not found", 404);

    const restaurantIds: number[] = [];
    if (String(current.reservation_type).toUpperCase() === "RESTAURANT") {
        restaurantIds.push(await restaurantIdForTable(req, current.table_id));
    }
    const nextType = String(req.body.reservation_type ?? current.reservation_type).toUpperCase();
    if (nextType === "RESTAURANT") {
        const nextTableId = req.body.table_id ?? current.table_id;
        restaurantIds.push(await restaurantIdForTable(req, nextTableId));
    }
    return restaurantIds;
};

export const restaurantIdsFromReservationBody: RestaurantIdResolver = async (req) => {
    if (String(req.body.reservation_type).toUpperCase() !== "RESTAURANT") return [];
    return [await restaurantIdForTable(req, req.body.table_id)];
};

export const restaurantIdsFromCombinedBooking: RestaurantIdResolver = async (req) => {
    const combinedBookingId = positiveId(req.params.id, "combined_booking_id");
    const { data, error } = await userScopedClient(req)
        .from("reservation")
        .select("reservation_type, table_id")
        .eq("combined_booking_id", combinedBookingId);
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    const restaurantIds: number[] = [];
    for (const reservation of data ?? []) {
        if (String(reservation.reservation_type).toUpperCase() === "RESTAURANT") {
            restaurantIds.push(await restaurantIdForTable(req, reservation.table_id));
        }
    }
    return restaurantIds;
};

export const restaurantIdsFromMediaRecord: RestaurantIdResolver = async (req) => {
    const mediaId = positiveId(req.params.id, "media_id");
    const { data, error } = await userScopedClient(req)
        .from("media")
        .select("restaurant_id")
        .eq("media_id", mediaId)
        .maybeSingle();
    if (error) throw new RestaurantAccessError("Unable to verify restaurant access", 500);
    return data?.restaurant_id == null ? [] : [Number(data.restaurant_id)];
};

export const restaurantIdFromMediaEntityParam: RestaurantIdResolver = async (req) =>
    req.params.entityType === "restaurant"
        ? [positiveId(req.params.entityId, "restaurant_id")]
        : [];
