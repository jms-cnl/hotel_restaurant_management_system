import { Router } from "express";
import {
    getHotelsController,
    getHotelByIdController,
    createHotelController,
    updateHotelController,
    deleteHotelController
} from "../controllers/hotel.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", optionalAuthenticate, getHotelsController);
router.get("/:id", optionalAuthenticate, getHotelByIdController);
router.post("/", authenticate, requireRole("Admin"), createHotelController);
router.put("/:id", authenticate, requireRole("Admin"), updateHotelController);
router.delete("/:id", authenticate, requireRole("Admin"), deleteHotelController);

export default router;
