import { Router } from "express";
import {
    getRoomsController,
    getRoomByIdController,
    createRoomController,
    updateRoomController,
    deleteRoomController
} from "../controllers/room.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getRoomsController);
router.get("/:id", getRoomByIdController);
router.post("/", requireRole("Admin", "Staff"), createRoomController);
router.put("/:id", requireRole("Admin", "Staff"), updateRoomController);
router.delete("/:id", requireRole("Admin", "Staff"), deleteRoomController);

export default router;
