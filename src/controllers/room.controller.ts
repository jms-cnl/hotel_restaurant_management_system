import type { Request, Response } from "express";
import { 
    getRooms,  
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom,
    RoomError
} from "../services/room.service.js";

export const getRoomsController = async (req: Request, res: Response) => {
    try {
        const rooms = await getRooms({
            status: req.query.status?.toString()
        });

        res.json(rooms);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve rooms",
            error: error
        });
    }
};

export const getRoomByIdController = async (req: Request, res: Response) => {
    try {
        const room = await getRoomById(Number(req.params.id));

        res.json(room);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve room",
            error: error
        });
    }
};

export const createRoomController = async (req: Request, res: Response) => {
    try {
        const room = await createRoom(req.body);

        res.status(201).json(room);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create room",
            error: error
        });
    }
};

export const updateRoomController = async (req: Request, res: Response) => {
    try {
        const room = await updateRoom(Number(req.params.id), req.body);

        res.json(room);
    } catch (error) {
        console.error(error);

        if (error instanceof RoomError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }

        res.status(500).json({
            message: "Failed to update room",
            error: error
        });
    }
};

export const deleteRoomController = async (req: Request, res: Response) => {
    try {
        await deleteRoom(Number(req.params.id));

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete room",
            error: error
        });
    }
};
