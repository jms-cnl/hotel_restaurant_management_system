import { Router } from "express";
import {
    getRoomsController,
    getRoomByIdController,
    createRoomController,
    updateRoomController,
    deleteRoomController
} from "../controllers/room.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    addRoomAmenityController,
    deleteRoomAmenityController,
    getRoomAmenitiesController
} from "../controllers/amenity-link.controller.js";

const router = Router();

router.get("/", optionalAuthenticate, getRoomsController);
router.get("/:roomId/amenities", optionalAuthenticate, getRoomAmenitiesController);
router.post("/:roomId/amenities", authenticate, requireRole("Admin"), addRoomAmenityController);
router.delete("/:roomId/amenities/:amenityId", authenticate, requireRole("Admin"), deleteRoomAmenityController);
router.get("/:id", optionalAuthenticate, getRoomByIdController);
router.post("/", authenticate, requireRole("Admin"), createRoomController);
router.put("/:id", authenticate, requireRole("Admin"), updateRoomController);
router.delete("/:id", authenticate, requireRole("Admin"), deleteRoomController);

export default router;
