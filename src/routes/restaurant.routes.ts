import { Router } from "express";
import {
    getRestaurantsController,
    getRestaurantByIdController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController
} from "../controllers/restaurant.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { requireRestaurantAccess, restaurantIdFromParam } from "../middleware/restaurant-access.middleware.js";
import { restaurantAmenityAccess } from "../middleware/restaurant-amenity-access.middleware.js";
import {
    addRestaurantAmenityController,
    deleteRestaurantAmenityController,
    getRestaurantAmenitiesController
} from "../controllers/amenity-link.controller.js";

const router = Router();

router.use(authenticate);
router.get("/", getRestaurantsController);
router.get("/:restaurantId/amenities", getRestaurantAmenitiesController);
router.post("/:restaurantId/amenities", requireRole("Admin", "Staff"), restaurantAmenityAccess, addRestaurantAmenityController);
router.delete("/:restaurantId/amenities/:amenityId", requireRole("Admin", "Staff"), restaurantAmenityAccess, deleteRestaurantAmenityController);
router.get("/:id", getRestaurantByIdController);
router.post("/", requireRole("Admin"), createRestaurantController);
router.put("/:id", requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdFromParam("id")), updateRestaurantController);
router.delete("/:id", requireRole("Admin"), deleteRestaurantController);

export default router;
