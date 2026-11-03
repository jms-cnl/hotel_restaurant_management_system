import { Router } from "express";
import {
    
    getTablesController,
    getTableByIdController,
    createTableController,
    updateTableController,
    deleteTableController
    
    
} from "../controllers/table.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    requireRestaurantAccess,
    restaurantIdFromTableBody,
    restaurantIdsFromTableRecord,
    restaurantIdsFromTableUpdate
} from "../middleware/restaurant-access.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getTablesController);
router.get("/:id", getTableByIdController);
router.post("/", requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdFromTableBody), createTableController);
router.put("/:id", requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdsFromTableUpdate), updateTableController);
router.delete("/:id", requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdsFromTableRecord), deleteTableController);

export default router;
