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
import { ReservationError } from "../services/reservation.service.js";

const statusForError = (error: unknown) => error instanceof ReservationError ? error.statusCode : 500;

export const getCombinedBookingsController = async (req: Request, res: Response) => {
    try {
        const combinedBookings = await getCombinedBookings({
            status: req.query.status?.toString(),
            user_id: req.query.user_id?.toString()
        });

        res.json(combinedBookings);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
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

        res.status(statusForError(error)).json({
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

        res.status(statusForError(error)).json({
            message: "Failed to retrieve combined booking reservations",
            error: error
        });
    }
};

export const createCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await createCombinedBooking(req.body, req.auth?.user.id ?? "");

        res.status(201).json(combinedBooking);
    } catch (error) {
        console.error(error);

        if (error instanceof ReservationError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        res.status(500).json({ message: "Failed to create combined booking" });
    }
};

export const createHotelRestaurantCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await createHotelRestaurantCombinedBooking(req.body, req.auth?.user.id ?? "");

        res.status(201).json(combinedBooking);
    } catch (error) {
        console.error(error);

        if (error instanceof ReservationError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        res.status(500).json({ message: "Failed to create combined booking" });
    }
};

export const updateCombinedBookingController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await updateCombinedBooking(Number(req.params.id), req.body, req.auth?.user.id ?? "");

        res.json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to update combined booking",
            error: error
        });
    }
};

export const deleteCombinedBookingController = async (req: Request, res: Response) => {
    try {
        await deleteCombinedBooking(Number(req.params.id), req.auth?.user.id ?? "");

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to delete combined booking",
            error: error
        });
    }
};

export const changeCombinedBookingStatusController = async (req: Request, res: Response) => {
    try {
        const combinedBooking = await changeCombinedBookingStatus(Number(req.params.id), req.body, req.auth?.user.id ?? "");

        res.json(combinedBooking);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to change combined booking status",
            error: error
        });
    }
};
