import { Router } from "express";
import {
    getRoomsController,
    getRoomByIdController,
    createRoomController,
    updateRoomController,
    deleteRoomController
} from "../controllers/room.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    addRoomAmenityController,
    deleteRoomAmenityController,
    getRoomAmenitiesController
} from "../controllers/amenity-link.controller.js";

const router = Router();

router.use(authenticate);
router.get("/", getRoomsController);
router.get("/:roomId/amenities", getRoomAmenitiesController);
router.post("/:roomId/amenities", requireRole("Admin", "Staff"), addRoomAmenityController);
router.delete("/:roomId/amenities/:amenityId", requireRole("Admin", "Staff"), deleteRoomAmenityController);
router.get("/:id", getRoomByIdController);
router.post("/", requireRole("Admin", "Staff"), createRoomController);
router.put("/:id", requireRole("Admin", "Staff"), updateRoomController);
router.delete("/:id", requireRole("Admin", "Staff"), deleteRoomController);

export default router;
