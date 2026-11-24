import type { Request, Response } from "express";
import { InvalidStatusError } from "../constants/status.js";
import { 
    getHotels, 
    getHotelById,
    updateHotel,
    HotelError,
} from "../services/hotel.service.js";

export const getHotelsController = async (req: Request, res: Response) => {
    try {
        const hotels = await getHotels({
            search: req.query.search?.toString()
        });

        res.json(hotels);
    } catch (error) {
        res.status(500).json({
            message: "Failed to retrieve hotels"
        });
    }
};

export const getHotelByIdController = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const hotel = await getHotelById(id);

        res.json(hotel);
    } catch (error) {
        res.status(500).json({
            message: "Failed to retrieve hotel"
        });
    }
};

export const updateHotelController = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const hotel = await updateHotel(id, req.body);

        res.json(hotel);
    } catch (error) {
        console.error(error);

        if (error instanceof InvalidStatusError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        if (error instanceof HotelError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        res.status(500).json({
            message: "Failed to update hotel",
            error: error
        });
    }
};
