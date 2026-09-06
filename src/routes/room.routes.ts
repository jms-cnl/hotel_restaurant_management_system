import { Router } from "express";
import {
    createRoomController,
    deleteRoomController,
    getRoomByIdController,
    getRoomsController,
    updateRoomController
} from "../controllers/room.controller.js";

const router = Router();

router.get("/", getRoomsController);
router.get("/:id", getRoomByIdController);
router.post("/", createRoomController);
router.put("/:id", updateRoomController);
router.delete("/:id", deleteRoomController);

export default router;
