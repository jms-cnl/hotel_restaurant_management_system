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

const statusForError = (error: unknown) => error instanceof ReservationError ? error.statusCode : 500;

export const getReservationsController = async (req: Request, res: Response) => {
    try {
        const reservations = await getReservations({
            status: req.query.status?.toString(),
            type: req.query.type?.toString(),
            combined_booking_id: req.query.combined_booking_id?.toString(),
            user_id: req.query.user_id?.toString()
        });

        res.json(reservations);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to retrieve reservations",
            error: error
        });
    }
};

export const getReservationByIdController = async (req: Request, res: Response) => {
    try {
        const reservation = await getReservationById(Number(req.params.id));

        res.json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to retrieve reservation",
            error: error
        });
    }
};

export const createReservationController = async (req: Request, res: Response) => {
    try {
        const reservation = await createReservation(req.body, req.auth?.user.id ?? "");

        res.status(201).json(reservation);
    } catch (error) {
        console.error(error);

        res.status(statusForError(error)).json({
            message: "Failed to create reservation",
            error: error
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
            message: "Failed to update reservation",
            error: error
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
            message: "Failed to cancel reservation",
            error: error
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
            message: "Failed to change reservation status",
            error: error
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
            message: "Failed to retrieve reservation history",
            error: error
        });
    }
};
