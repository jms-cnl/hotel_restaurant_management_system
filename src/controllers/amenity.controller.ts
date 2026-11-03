import type { Request, Response } from "express";
import { AmenityError, createAmenity, deleteAmenity, getAmenities, updateAmenity } from "../services/amenity.service.js";

const sendError = (res: Response, error: unknown, fallback: string) => {
    console.error(error);
    if (error instanceof AmenityError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    res.status(500).json({ message: fallback });
};

const bodyObject = (body: unknown): Record<string, unknown> =>
    body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};

export const getAmenitiesController = async (req: Request, res: Response) => {
    try {
        res.json(await getAmenities(req, req.query.hotel_id));
    } catch (error) {
        sendError(res, error, "Failed to retrieve amenities");
    }
};

export const createAmenityController = async (req: Request, res: Response) => {
    try {
        res.status(201).json(await createAmenity(req, bodyObject(req.body)));
    } catch (error) {
        sendError(res, error, "Failed to create amenity");
    }
};

export const updateAmenityController = async (req: Request, res: Response) => {
    try {
        res.json(await updateAmenity(req, String(req.params.id ?? ""), bodyObject(req.body)));
    } catch (error) {
        sendError(res, error, "Failed to update amenity");
    }
};

export const deleteAmenityController = async (req: Request, res: Response) => {
    try {
        await deleteAmenity(req, String(req.params.id ?? ""));
        res.status(204).send();
    } catch (error) {
        sendError(res, error, "Failed to delete amenity");
    }
};
