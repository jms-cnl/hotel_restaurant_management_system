import { Router } from "express";
import {
    
    getTablesController,
    getTableByIdController,
    createTableController,
    updateTableController,
    deleteTableController
    
    
} from "../controllers/table.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getTablesController);
router.get("/:id", getTableByIdController);
router.post("/", requireRole("Admin", "Staff"), createTableController);
router.put("/:id", requireRole("Admin", "Staff"), updateTableController);
router.delete("/:id", requireRole("Admin", "Staff"), deleteTableController);

export default router;
