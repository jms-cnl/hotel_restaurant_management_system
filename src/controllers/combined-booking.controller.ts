import type { Request, Response } from "express";
import {
    changeCombinedBookingStatus,
    createCombinedBooking,
    createHotelRestaurantCombinedBooking,
    deleteCombinedBooking,
    getCombinedBookingById,
    getCombinedBookingReservations,
    getCombinedBookings,
    updateCombinedBooking
} from "../services/combined-booking.service.js";

export const getCombinedBookingsController = async (req: Request, res: Response) => {
    try {
        const combinedBookings = await getCombinedBookings({
            status: req.query.status?.toString(),
            user_id: req.query.user_id?.toString()
        });

        res.json(combinedBookings);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve combined bookings",
            error: error
        });
    }
};

export const getCombinedBookingByIdController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await getCombinedBookingById(Number(req.params.id));

        res.json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve combined booking",
            error: error
        });
    }
};

export const getCombinedBookingReservationsController = async (req: Request, res: Response) => {
    try {
        const reservations = await getCombinedBookingReservations(Number(req.params.id));

        res.json(reservations);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve combined booking reservations",
            error: error
        });
    }
};

export const createCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await createCombinedBooking(req.body);

        res.status(201).json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create combined booking",
            error: error
        });
    }
};

export const createHotelRestaurantCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await createHotelRestaurantCombinedBooking(req.body);

        res.status(201).json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create hotel and restaurant combined booking",
            error: error
        });
    }
};

export const updateCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await updateCombinedBooking(Number(req.params.id), req.body);

        res.json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update combined booking",
            error: error
        });
    }
};

export const deleteCombinedBookingController = async (req: Request, res: Response) => {
    try {
        await deleteCombinedBooking(Number(req.params.id));

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete combined booking",
            error: error
        });
    }
};

export const changeCombinedBookingStatusController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await changeCombinedBookingStatus(Number(req.params.id), req.body);

        res.json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to change combined booking status",
            error: error
        });
    }
};
