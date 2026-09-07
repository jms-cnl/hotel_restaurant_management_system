import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase.js";

export type MediaEntityType = "hotel" | "restaurant" | "room" | "table";
type MediaEntity = { type: MediaEntityType; id: number };
type MediaFile = { buffer: Buffer; mimetype: string; size: number };

const BUCKET = "reservation-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const entityColumns: Record<MediaEntityType, string> = {
    hotel: "hotel_id",
    restaurant: "restaurant_id",
    room: "room_id",
    table: "table_id"
};
const entityTables: Record<MediaEntityType, string> = {
    hotel: "hotel",
    restaurant: "restaurant",
    room: "room",
    table: "restaurant_table"
};
const mimeToType = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WEBP" } as const;

export class MediaError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "MediaError";
    }
}

const parseEntity = (type: string, id: number): MediaEntity => {
    if (!(type in entityColumns) || !Number.isInteger(id) || id <= 0) throw new MediaError("Invalid media entity", 400);
    return { type: type as MediaEntityType, id };
};

const assertImage = (file: MediaFile) => {
    if (!file || file.size <= 0) throw new MediaError("An image file is required", 400);
    if (file.size > MAX_FILE_SIZE) throw new MediaError("Image must be 5 MB or smaller", 413);
    if (!(file.mimetype in mimeToType)) throw new MediaError("Only JPG, PNG, and WebP images are supported", 415);

    const isJpeg = file.mimetype === "image/jpeg" && file.buffer[0] === 0xff && file.buffer[1] === 0xd8;
    const isPng = file.mimetype === "image/png" && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = file.mimetype === "image/webp" && file.buffer.subarray(0, 4).toString("ascii") === "RIFF" && file.buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isJpeg && !isPng && !isWebp) throw new MediaError("The uploaded file is not a valid supported image", 415);
};

const assertEntityExists = async (entity: MediaEntity) => {
    const { data, error } = await supabase.from(entityTables[entity.type]).select("*").eq(`${entity.type === "table" ? "table_id" : `${entity.type}_id`}`, entity.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new MediaError("Media entity not found", 404);
};

const pathFor = (entity: MediaEntity, file: MediaFile) => `${entity.type}s/${entity.id}/${randomUUID()}.${file.mimetype === "image/jpeg" ? "jpg" : file.mimetype.slice("image/".length)}`;

const removeStorageFile = async (path: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
};

const uploadStorageFile = async (path: string, file: MediaFile) => {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false
    });
    if (error) throw error;
};

const withSignedUrl = async (media: Record<string, unknown>) => {
    const { data, error } = await supabase.storage.from(String(media.storage_bucket)).createSignedUrl(String(media.storage_path), 3600);
    if (error || !data?.signedUrl) throw error ?? new Error("Unable to create media URL");
    return { ...media, url: data.signedUrl };
};

export const getMedia = async (type: string, id: number) => {
    const entity = parseEntity(type, id);
    await assertEntityExists(entity);
    const { data, error } = await supabase.from("media").select("*").eq(entityColumns[entity.type], entity.id).order("display_order", { ascending: true }).order("media_id", { ascending: true });
    if (error) throw error;
    return Promise.all((data ?? []).map((media) => withSignedUrl(media as Record<string, unknown>)));
};

export const uploadMedia = async (type: string, id: number, file: MediaFile, primary = false) => {
    const entity = parseEntity(type, id);
    assertImage(file);
    await assertEntityExists(entity);
    const entityColumn = entityColumns[entity.type];
    const { data: existing, error: existingError } = await supabase.from("media").select("media_id, display_order").eq(entityColumn, entity.id).order("display_order", { ascending: false }).limit(1);
    if (existingError) throw existingError;
    const isPrimary = primary || (existing?.length ?? 0) === 0;
    const path = pathFor(entity, file);
    await uploadStorageFile(path, file);

    try {
        if (isPrimary) {
            const { error } = await supabase.from("media").update({ is_primary: false }).eq(entityColumn, entity.id);
            if (error) throw error;
        }
        const { data, error } = await supabase.from("media").insert({
            [entityColumn]: entity.id,
            image_type: mimeToType[file.mimetype as keyof typeof mimeToType],
            storage_bucket: BUCKET,
            storage_path: path,
            file_size: file.size,
            is_primary: isPrimary,
            display_order: (existing?.[0]?.display_order ?? -1) + 1
        }).select().single();
        if (error) throw error;
        return withSignedUrl(data as Record<string, unknown>);
    } catch (error) {
        await removeStorageFile(path).catch(() => undefined);
        throw error;
    }
};

export const replaceMedia = async (id: number, file: MediaFile) => {
    assertImage(file);
    const { data: current, error: currentError } = await supabase.from("media").select("*").eq("media_id", id).single();
    if (currentError || !current) throw currentError ?? new MediaError("Media not found", 404);
    const entityType = (Object.entries(entityColumns).find(([, column]) => current[column] !== null)?.[0] ?? "") as MediaEntityType;
    if (!entityType) throw new MediaError("Media entity is invalid", 500);
    const entity = { type: entityType, id: Number(current[entityColumns[entityType]]) };
    const path = pathFor(entity, file);
    await uploadStorageFile(path, file);
    let data: Record<string, unknown>;
    try {
        const { data: updated, error } = await supabase.from("media").update({
            image_type: mimeToType[file.mimetype as keyof typeof mimeToType],
            storage_path: path,
            file_size: file.size
        }).eq("media_id", id).select().single();
        if (error) throw error;
        data = updated as Record<string, unknown>;
    } catch (error) {
        await removeStorageFile(path).catch(() => undefined);
        throw error;
    }

    try {
        await removeStorageFile(String(current.storage_path)).catch((storageError) => {
            console.error("Unable to remove replaced media file", { mediaId: id, error: storageError instanceof Error ? storageError.message : "unknown" });
        });
    } catch { /* Storage cleanup is best effort after metadata points to the new file. */ }
    return withSignedUrl(data);
};

export const setPrimaryMedia = async (id: number) => {
    const { data: current, error: currentError } = await supabase.from("media").select("*").eq("media_id", id).single();
    if (currentError || !current) throw currentError ?? new MediaError("Media not found", 404);
    const entityType = (Object.entries(entityColumns).find(([, column]) => current[column] !== null)?.[0] ?? "") as MediaEntityType;
    if (!entityType) throw new MediaError("Media entity is invalid", 500);
    const entityColumn = entityColumns[entityType];
    const entityId = Number(current[entityColumn]);
    const { error: clearError } = await supabase.from("media").update({ is_primary: false }).eq(entityColumn, entityId);
    if (clearError) throw clearError;
    const { data, error } = await supabase.from("media").update({ is_primary: true }).eq("media_id", id).select().single();
    if (error) throw error;
    return withSignedUrl(data as Record<string, unknown>);
};

export const updateMediaOrder = async (id: number, displayOrder: number) => {
    if (!Number.isInteger(displayOrder) || displayOrder < 0) throw new MediaError("Display order must be a non-negative integer");
    const { data, error } = await supabase.from("media").update({ display_order: displayOrder }).eq("media_id", id).select().single();
    if (error || !data) throw error ?? new MediaError("Media not found", 404);
    return withSignedUrl(data as Record<string, unknown>);
};

export const deleteMedia = async (id: number) => {
    const { data: current, error: currentError } = await supabase.from("media").select("storage_bucket, storage_path").eq("media_id", id).single();
    if (currentError || !current) throw currentError ?? new MediaError("Media not found", 404);
    await removeStorageFile(String(current.storage_path));
    const { error } = await supabase.from("media").delete().eq("media_id", id);
    if (error) throw error;
};

export const deleteMediaForEntity = async (type: string, id: number) => {
    const entity = parseEntity(type, id);
    const { data, error } = await supabase.from("media").select("storage_path").eq(entityColumns[entity.type], entity.id);
    if (error) throw error;
    for (const media of data ?? []) await removeStorageFile(String(media.storage_path));
    const { error: deleteError } = await supabase.from("media").delete().eq(entityColumns[entity.type], entity.id);
    if (deleteError) throw deleteError;
};
