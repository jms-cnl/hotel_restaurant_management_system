import { Router } from "express";
import {
    getHotelsController,
    getHotelByIdController,
    createHotelController,
    updateHotelController,
    deleteHotelController
} from "../controllers/hotel.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getHotelsController);
router.get("/:id", getHotelByIdController);
router.post("/", requireRole("Admin"), createHotelController);
router.put("/:id", requireRole("Admin"), updateHotelController);
router.delete("/:id", requireRole("Admin"), deleteHotelController);

export default router;
