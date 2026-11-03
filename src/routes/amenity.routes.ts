import { Router } from "express";
import {
    createAmenityController,
    deleteAmenityController,
    getAmenitiesController,
    updateAmenityController
} from "../controllers/amenity.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", optionalAuthenticate, getAmenitiesController);
router.post("/", authenticate, requireRole("Admin"), createAmenityController);
router.put("/:id", authenticate, requireRole("Admin"), updateAmenityController);
router.delete("/:id", authenticate, requireRole("Admin"), deleteAmenityController);

export default router;
