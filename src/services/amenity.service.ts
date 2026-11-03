import type { Request } from "express";
import { getRequestSupabase } from "../config/supabase.js";

export class AmenityError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "AmenityError";
    }
}

const positiveInteger = (value: unknown): number | null => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "string" && !/^\d+$/.test(value)) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const amenityIdFrom = (id: string) => {
    const parsed = positiveInteger(id);
    if (parsed === null) throw new AmenityError("Invalid amenity id");
    return parsed;
};

const validateName = (name: unknown): string => {
    if (typeof name !== "string") throw new AmenityError("Invalid amenity fields");
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) throw new AmenityError("Invalid amenity fields");
    return trimmed;
};

const validateDescription = (description: unknown): string | null => {
    if (description === null) return null;
    if (typeof description !== "string" || description.length > 1000) {
        throw new AmenityError("Invalid amenity fields");
    }
    return description;
};

const isDuplicateError = (error: { code?: string } | null) => error?.code === "23505";

const assertUniqueName = async (client: ReturnType<typeof getRequestSupabase>, hotelId: number, name: string, exceptAmenityId?: number) => {
    let query = client.from("amenity").select("amenity_id").eq("hotel_id", hotelId).eq("name", name);
    if (exceptAmenityId !== undefined) query = query.neq("amenity_id", exceptAmenityId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) throw new AmenityError("Amenity already exists", 409);
};

export const getAmenities = async (req: Request, hotelIdValue: unknown) => {
    const client = getRequestSupabase(req);
    let query = client.from("amenity").select("*");
    if (hotelIdValue !== undefined) {
        const hotelId = positiveInteger(hotelIdValue);
        if (hotelId === null) throw new AmenityError("Invalid hotel id");
        query = query.eq("hotel_id", hotelId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
};

export const createAmenity = async (req: Request, body: Record<string, unknown>) => {
    const hotelId = positiveInteger(body.hotel_id);
    if (hotelId === null) throw new AmenityError("Invalid hotel id");
    const name = validateName(body.name);
    const description = body.description === undefined ? undefined : validateDescription(body.description);
    const client = getRequestSupabase(req);

    const { data: hotel, error: hotelError } = await client
        .from("hotel")
        .select("hotel_id")
        .eq("hotel_id", hotelId)
        .maybeSingle();
    if (hotelError) throw hotelError;
    if (!hotel) throw new AmenityError("Hotel not found");

    await assertUniqueName(client, hotelId, name);
    const payload = description === undefined ? { hotel_id: hotelId, name } : { hotel_id: hotelId, name, description };
    const { data, error } = await client.from("amenity").insert(payload as never).select("*").single();
    if (isDuplicateError(error)) throw new AmenityError("Amenity already exists", 409);
    if (error) throw error;
    return data;
};

export const updateAmenity = async (req: Request, idValue: string, body: Record<string, unknown>) => {
    const amenityId = amenityIdFrom(idValue);
    const updates: { name?: string; description?: string | null } = {};
    if (Object.hasOwn(body, "name")) updates.name = validateName(body.name);
    if (Object.hasOwn(body, "description")) updates.description = validateDescription(body.description);
    if (Object.keys(updates).length === 0) throw new AmenityError("No fields to update");

    const client = getRequestSupabase(req);
    const { data: amenity, error: amenityError } = await client
        .from("amenity")
        .select("amenity_id, hotel_id, name")
        .eq("amenity_id", amenityId)
        .maybeSingle();
    if (amenityError) throw amenityError;
    if (!amenity) throw new AmenityError("Amenity not found", 404);

    if (updates.name !== undefined && updates.name !== amenity.name) {
        await assertUniqueName(client, amenity.hotel_id, updates.name, amenityId);
    }
    const { data, error } = await client
        .from("amenity")
        .update(updates)
        .eq("amenity_id", amenityId)
        .select("*")
        .maybeSingle();
    if (isDuplicateError(error)) throw new AmenityError("Amenity already exists", 409);
    if (error) throw error;
    if (!data) throw new AmenityError("Amenity not found", 404);
    return data;
};

export const deleteAmenity = async (req: Request, idValue: string) => {
    const amenityId = amenityIdFrom(idValue);
    const { data, error } = await getRequestSupabase(req)
        .from("amenity")
        .delete()
        .eq("amenity_id", amenityId)
        .select("amenity_id")
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new AmenityError("Amenity not found", 404);
};
