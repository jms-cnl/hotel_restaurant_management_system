import type { Request, Response } from "express";
import { deleteMedia, getMedia, MediaError, replaceMedia, setPrimaryMedia, updateMediaOrder, uploadMedia } from "../services/media.service.js";

const handleError = (res: Response, error: unknown, fallback: string) => {
    if (error instanceof MediaError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    console.error(error);
    res.status(500).json({ message: fallback });
};

export const getMediaController = async (req: Request, res: Response) => {
    try { res.json(await getMedia(String(req.params.entityType), Number(req.params.entityId))); }
    catch (error) { handleError(res, error, "Failed to retrieve media"); }
};

export const uploadMediaController = async (req: Request, res: Response) => {
    try {
        const primary = req.body.primary === "true" || req.body.primary === "1";
        res.status(201).json(await uploadMedia(String(req.params.entityType), Number(req.params.entityId), req.file as never, primary));
    } catch (error) { handleError(res, error, "Failed to upload media"); }
};

export const replaceMediaController = async (req: Request, res: Response) => {
    try { res.json(await replaceMedia(Number(req.params.id), req.file as never)); }
    catch (error) { handleError(res, error, "Failed to replace media"); }
};

export const setPrimaryMediaController = async (req: Request, res: Response) => {
    try { res.json(await setPrimaryMedia(Number(req.params.id))); }
    catch (error) { handleError(res, error, "Failed to set primary media"); }
};

export const updateMediaOrderController = async (req: Request, res: Response) => {
    try { res.json(await updateMediaOrder(Number(req.params.id), Number(req.body.display_order))); }
    catch (error) { handleError(res, error, "Failed to update media order"); }
};

export const deleteMediaController = async (req: Request, res: Response) => {
    try { await deleteMedia(Number(req.params.id)); res.status(204).send(); }
    catch (error) { handleError(res, error, "Failed to delete media"); }
};
