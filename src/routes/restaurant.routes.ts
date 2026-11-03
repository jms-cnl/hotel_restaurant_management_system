import { Router } from "express";
import {
    getRestaurantsController,
    getRestaurantByIdController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController
} from "../controllers/restaurant.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";
import { requireRestaurantAccess, restaurantIdFromParam } from "../middleware/restaurant-access.middleware.js";
import { restaurantAmenityAccess } from "../middleware/restaurant-amenity-access.middleware.js";
import {
    addRestaurantAmenityController,
    deleteRestaurantAmenityController,
    getRestaurantAmenitiesController
} from "../controllers/amenity-link.controller.js";

const router = Router();

router.get("/", optionalAuthenticate, getRestaurantsController);
router.get("/:restaurantId/amenities", optionalAuthenticate, getRestaurantAmenitiesController);
router.post("/:restaurantId/amenities", authenticate, requireRole("Admin", "Staff"), restaurantAmenityAccess, addRestaurantAmenityController);
router.delete("/:restaurantId/amenities/:amenityId", authenticate, requireRole("Admin", "Staff"), restaurantAmenityAccess, deleteRestaurantAmenityController);
router.get("/:id", optionalAuthenticate, getRestaurantByIdController);
router.post("/", authenticate, requireRole("Admin"), createRestaurantController);
router.put("/:id", authenticate, requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdFromParam("id")), updateRestaurantController);
router.delete("/:id", authenticate, requireRole("Admin"), deleteRestaurantController);

export default router;
