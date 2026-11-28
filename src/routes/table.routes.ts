import { Router } from "express";
import {
    
    getTablesController,
    getTableByIdController,
    createTableController,
    updateTableController,
    deleteTableController
    
    
} from "../controllers/table.controller.js";
import {
    addTableAmenityController,
    deleteTableAmenityController,
    getTableAmenitiesController
} from "../controllers/amenity-link.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    requireRestaurantAccess,
    restaurantIdFromTableBody,
    restaurantIdsFromTableRecord,
    restaurantIdsFromTableUpdate
} from "../middleware/restaurant-access.middleware.js";

const router = Router();

router.get("/", optionalAuthenticate, getTablesController);
router.get("/:tableId/amenities", optionalAuthenticate, requireRole("Staff", "Admin"), getTableAmenitiesController);
router.post("/:tableId/amenities", authenticate, requireRole("Admin"), addTableAmenityController);
router.delete("/:tableId/amenities/:amenityId", authenticate, requireRole("Admin"), deleteTableAmenityController);
router.get("/:id", optionalAuthenticate, getTableByIdController);
router.post("/", authenticate, requireRole("Admin"), requireRestaurantAccess(restaurantIdFromTableBody), createTableController);
router.put("/:id", authenticate, requireRole("Admin"), requireRestaurantAccess(restaurantIdsFromTableUpdate), updateTableController);
router.delete("/:id", authenticate, requireRole("Admin"), requireRestaurantAccess(restaurantIdsFromTableRecord), deleteTableController);

export default router;
