import { Router } from "express";
import {
    getRestaurantsController,
    getRestaurantByIdController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController
} from "../controllers/restaurant.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getRestaurantsController);
router.get("/:id", getRestaurantByIdController);
router.post("/", requireRole("Admin", "Staff"), createRestaurantController);
router.put("/:id", requireRole("Admin", "Staff"), updateRestaurantController);
router.delete("/:id", requireRole("Admin", "Staff"), deleteRestaurantController);

export default router;
