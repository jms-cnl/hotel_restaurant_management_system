import type { Request, Response } from "express";
import {
    createStaffAssignment,
    deleteStaffAssignment,
    getStaffAssignments,
    StaffAssignmentError
} from "../services/staff-assignment.service.js";

const sendError = (res: Response, error: unknown, fallback: string) => {
    console.error(error);
    if (error instanceof StaffAssignmentError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    res.status(500).json({ message: fallback });
};

export const getStaffAssignmentsController = async (req: Request, res: Response) => {
    try {
        res.json(await getStaffAssignments(req));
    } catch (error) {
        sendError(res, error, "Failed to retrieve staff assignments");
    }
};

export const createStaffAssignmentController = async (req: Request, res: Response) => {
    try {
        res.status(201).json(await createStaffAssignment(req, req.body));
    } catch (error) {
        sendError(res, error, "Failed to create staff assignment");
    }
};

export const deleteStaffAssignmentController = async (req: Request, res: Response) => {
    try {
        await deleteStaffAssignment(req, String(req.params.userId ?? ""), String(req.params.restaurantId ?? ""));
        res.status(204).send();
    } catch (error) {
        sendError(res, error, "Failed to delete staff assignment");
    }
};
