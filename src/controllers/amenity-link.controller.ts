import type { Request, Response } from "express";
import { addResourceAmenity, AmenityLinkError, deleteResourceAmenity, getResourceAmenities } from "../services/amenity-link.service.js";

type Resource = "room" | "restaurant";

const sendError = (res: Response, error: unknown, fallback: string) => {
    console.error(error);
    if (error instanceof AmenityLinkError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    res.status(500).json({ message: fallback });
};

const resourceId = (req: Request, resource: Resource) => req.params[resource === "room" ? "roomId" : "restaurantId"];

export const getRoomAmenitiesController = async (req: Request, res: Response) => {
    try { res.json(await getResourceAmenities(req, "room", resourceId(req, "room"))); }
    catch (error) { sendError(res, error, "Failed to retrieve room amenities"); }
};

export const addRoomAmenityController = async (req: Request, res: Response) => {
    try { res.status(201).json(await addResourceAmenity(req, "room", resourceId(req, "room"), req.body?.amenity_id)); }
    catch (error) { sendError(res, error, "Failed to link amenity to room"); }
};

export const deleteRoomAmenityController = async (req: Request, res: Response) => {
    try {
        await deleteResourceAmenity(req, "room", resourceId(req, "room"), req.params.amenityId);
        res.status(204).send();
    } catch (error) { sendError(res, error, "Failed to unlink amenity from room"); }
};

export const getRestaurantAmenitiesController = async (req: Request, res: Response) => {
    try { res.json(await getResourceAmenities(req, "restaurant", resourceId(req, "restaurant"))); }
    catch (error) { sendError(res, error, "Failed to retrieve restaurant amenities"); }
};

export const addRestaurantAmenityController = async (req: Request, res: Response) => {
    try { res.status(201).json(await addResourceAmenity(req, "restaurant", resourceId(req, "restaurant"), req.body?.amenity_id)); }
    catch (error) { sendError(res, error, "Failed to link amenity to restaurant"); }
};

export const deleteRestaurantAmenityController = async (req: Request, res: Response) => {
    try {
        await deleteResourceAmenity(req, "restaurant", resourceId(req, "restaurant"), req.params.amenityId);
        res.status(204).send();
    } catch (error) { sendError(res, error, "Failed to unlink amenity from restaurant"); }
};
