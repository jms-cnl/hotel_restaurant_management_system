import { Router } from "express";
import {
    createAmenityController,
    deleteAmenityController,
    getAmenitiesController,
    updateAmenityController
} from "../controllers/amenity.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getAmenitiesController);
router.post("/", requireRole("Admin"), createAmenityController);
router.put("/:id", requireRole("Admin"), updateAmenityController);
router.delete("/:id", requireRole("Admin"), deleteAmenityController);

export default router;
