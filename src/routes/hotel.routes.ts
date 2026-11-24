import { Router } from "express";
import {
    getHotelsController,
    getHotelByIdController,
    updateHotelController
} from "../controllers/hotel.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", optionalAuthenticate, getHotelsController);
router.get("/:id", optionalAuthenticate, getHotelByIdController);
router.put("/:id", authenticate, requireRole("Admin"), updateHotelController);

export default router;
