import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";
import { assertRestaurantAccess, RestaurantAccessError } from "../middleware/restaurant-access.middleware.js";

export class AmenityLinkError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "AmenityLinkError";
    }
}

type Resource = "room" | "restaurant" | "table";
const resourceFields = {
    room: { id: "room_id", linkTable: "room_amenity", linkId: "room_id", invalid: "Invalid room id", missing: "Room not found" },
    restaurant: { id: "restaurant_id", linkTable: "restaurant_amenity", linkId: "restaurant_id", invalid: "Invalid restaurant id", missing: "Restaurant not found" },
    table: { id: "table_id", linkTable: "table_amenity", linkId: "table_id", invalid: "Invalid table id", missing: "Table not found" },
} as const;

const parseId = (value: unknown, invalidMessage: string): number => {
    if (typeof value !== "string" && typeof value !== "number") throw new AmenityLinkError(invalidMessage);
    if (typeof value === "string" && !/^\d+$/.test(value)) throw new AmenityLinkError(invalidMessage);
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AmenityLinkError(invalidMessage);
    return parsed;
};

const getResource = async (req: Request, resource: Resource, resourceId: number) => {
    const fields = resourceFields[resource];
    if (resource === "table") {
        const { data, error } = await getRequestSupabase(req)
            .from("restaurant_table")
            .select("table_id, restaurant_id, restaurant(hotel_id)")
            .eq("table_id", resourceId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new AmenityLinkError(fields.missing, 404);
        const restaurant = Array.isArray(data.restaurant) ? data.restaurant[0] : data.restaurant;
        if (!restaurant) throw new AmenityLinkError("Table restaurant not found", 404);
        return { ...data, hotel_id: restaurant.hotel_id };
    }
    const { data, error } = await getRequestSupabase(req)
        .from(resource)
        .select(`${fields.id}, hotel_id`)
        .eq(fields.id, resourceId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new AmenityLinkError(fields.missing, 404);
    return data;
};

const verifyTableStaffAccess = async (req: Request, parent: { restaurant_id: number }) => {
    try {
        await assertRestaurantAccess(req, Number(parent.restaurant_id));
    } catch (error) {
        if (error instanceof RestaurantAccessError) throw new AmenityLinkError(error.message, error.statusCode);
        throw error;
    }
};

const getAmenity = async (req: Request, amenityId: number) => {
    const { data, error } = await getRequestSupabase(req)
        .from("amenity")
        .select("amenity_id, hotel_id, name, description")
        .eq("amenity_id", amenityId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new AmenityLinkError("Amenity not found", 404);
    return data;
};

export const getResourceAmenities = async (req: Request, resource: Resource, resourceIdValue: unknown) => {
    const fields = resourceFields[resource];
    const resourceId = parseId(resourceIdValue, fields.invalid);
    const parent = await getResource(req, resource, resourceId);
    if (resource === "table" && req.auth?.roleName.toLowerCase() === "staff") {
        await verifyTableStaffAccess(req, parent as { restaurant_id: number });
    }
    const { data: links, error: linkError } = await getRequestSupabase(req)
        .from(fields.linkTable)
        .select("amenity_id")
        .eq(fields.linkId, resourceId);
    if (linkError) throw linkError;
    const amenityIds = (links ?? []).map((link) => Number(link.amenity_id));
    if (amenityIds.length === 0) return [];
    const { data, error } = await getRequestSupabase(req)
        .from("amenity")
        .select("amenity_id, name, description")
        .in("amenity_id", amenityIds);
    if (error) throw error;
    return data ?? [];
};

export const addResourceAmenity = async (
    req: Request,
    resource: Resource,
    resourceIdValue: unknown,
    amenityIdValue: unknown
) => {
    const fields = resourceFields[resource];
    const resourceId = parseId(resourceIdValue, fields.invalid);
    const amenityId = parseId(amenityIdValue, "Invalid amenity id");
    const parent = await getResource(req, resource, resourceId);
    const amenity = await getAmenity(req, amenityId);
    if (Number(parent.hotel_id) !== Number(amenity.hotel_id)) {
        throw new AmenityLinkError("Amenity belongs to a different hotel");
    }

    const client = getRequestSupabase(req);
    const { data: link, error: linkError } = await client
        .from(fields.linkTable)
        .select("amenity_id")
        .eq(fields.linkId, resourceId)
        .eq("amenity_id", amenityId)
        .maybeSingle();
    if (linkError) throw linkError;
    if (link) throw new AmenityLinkError("Amenity already linked", 409);

    const payload = { [fields.linkId]: resourceId, amenity_id: amenityId };
    const { data, error } = await client.from(fields.linkTable).insert(payload as never).select("*").single();
    if (error?.code === "23505") throw new AmenityLinkError("Amenity already linked", 409);
    if (error) throw error;
    return data;
};

export const deleteResourceAmenity = async (
    req: Request,
    resource: Resource,
    resourceIdValue: unknown,
    amenityIdValue: unknown
) => {
    const fields = resourceFields[resource];
    const resourceId = parseId(resourceIdValue, fields.invalid);
    const amenityId = parseId(amenityIdValue, "Invalid amenity id");
    const parent = await getResource(req, resource, resourceId);
    const amenity = await getAmenity(req, amenityId);
    if (Number(parent.hotel_id) !== Number(amenity.hotel_id)) {
        throw new AmenityLinkError("Amenity belongs to a different hotel");
    }
    const { data, error } = await getRequestSupabase(req)
        .from(fields.linkTable)
        .delete()
        .eq(fields.linkId, resourceId)
        .eq("amenity_id", amenityId)
        .select("amenity_id")
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new AmenityLinkError("Amenity link not found", 404);
};
