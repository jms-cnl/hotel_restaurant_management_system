import { Router } from "express";
import {
    createTableController,
    deleteTableController,
    getTableByIdController,
    getTablesController,
    updateTableController
} from "../controllers/table.controller.js";

const router = Router();

router.get("/", getTablesController);
router.get("/:id", getTableByIdController);
router.post("/", createTableController);
router.put("/:id", updateTableController);
router.delete("/:id", deleteTableController);

export default router;
