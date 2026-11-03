import { Router } from "express";
import {
    
    getTablesController,
    getTableByIdController,
    createTableController,
    updateTableController,
    deleteTableController
    
    
} from "../controllers/table.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    requireRestaurantAccess,
    restaurantIdFromTableBody,
    restaurantIdsFromTableRecord,
    restaurantIdsFromTableUpdate
} from "../middleware/restaurant-access.middleware.js";

const router = Router();

router.get("/", optionalAuthenticate, getTablesController);
router.get("/:id", optionalAuthenticate, getTableByIdController);
router.post("/", authenticate, requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdFromTableBody), createTableController);
router.put("/:id", authenticate, requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdsFromTableUpdate), updateTableController);
router.delete("/:id", authenticate, requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdsFromTableRecord), deleteTableController);

export default router;
