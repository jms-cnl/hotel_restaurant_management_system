import type { Request, Response } from "express";
import {
    getReservations,
    getReservationById,
    createReservation,
    updateReservation,
    deleteReservation,
    changeReservationStatus,
    getReservationHistory
} from "../services/reservation.service.js";
import { ReservationError } from "../services/reservation.service.js";
import { getAssignedRestaurantIds, RestaurantAccessError } from "../middleware/restaurant-access.middleware.js";

const statusForError = (error: unknown) => error instanceof ReservationError ? error.statusCode : 500;

export const getReservationsController = async (req: Request, res: Response) => {
    try {
        const reservations = await getReservations({
            status: req.query.status?.toString(),
            type: req.query.type?.toString(),
            combined_booking_id: req.query.combined_booking_id?.toString(),
            user_id: req.query.user_id?.toString()
        });

        if (req.auth?.roleName.toLowerCase() !== "staff") {
            res.json(reservations);
            return;
        }

        const assignedRestaurantIds = new Set(await getAssignedRestaurantIds(req));
        res.json((reservations ?? []).filter((reservation) => {
            if (String(reservation.reservation_type).toUpperCase() !== "RESTAURANT") return true;
            const table = Array.isArray(reservation.restaurant_table) ? reservation.restaurant_table[0] : reservation.restaurant_table;
            return table?.restaurant_id !== undefined && assignedRestaurantIds.has(Number(table.restaurant_id));
        }));
    } catch (error) {
        console.error(error);

        const status = error instanceof RestaurantAccessError ? error.statusCode : statusForError(error);
        res.status(status).json({ message: error instanceof RestaurantAccessError ? error.message : "Failed to retrieve reservations" });
    }
};

export const getReservationByIdController = async (req: Request, res: Response) => {
    try {
        const reservation = await getReservationById(Number(req.params.id));

        res.json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to retrieve reservation"
        });
    }
};

export const createReservationController = async (req: Request, res: Response) => {
    try {
        const reservation = await createReservation(req.body, req.auth?.user.id ?? "");

        res.status(201).json(reservation);
    } catch (error) {
        console.error(error);

        if (error instanceof ReservationError && error.statusCode === 409) {
            res.status(409).json({ message: error.message });
            return;
        }

        res.status(statusForError(error)).json({
            message: "Failed to create reservation"
        });
    }
};

export const updateReservationController = async (req: Request, res: Response) => {
    try {
        const reservation = await updateReservation(Number(req.params.id), req.body);

        res.json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to update reservation"
        });
    }
};

export const deleteReservationController = async (req: Request, res: Response) => {
    try {
        const reservation = await deleteReservation(Number(req.params.id), req.auth?.user.id ?? "");

        res.json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to cancel reservation"
        });
    }
};

export const changeReservationStatusController = async (req: Request, res: Response) => {
    try {
        const reservation = await changeReservationStatus(Number(req.params.id), req.body, req.auth?.user.id ?? "");

        res.json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to change reservation status"
        });
    }
};

export const getReservationHistoryController = async (req: Request, res: Response) => {
    try {
        const history = await getReservationHistory(Number(req.params.id));

        res.json(history);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to retrieve reservation history"
        });
    }
};
