import { Router } from "express";
import {
    getOccupancyReportController,
    getReservationReportController,
    getRevenueReportController,
    getTableReportController
} from "../controllers/report.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/reservations", authenticate, requireRole("Admin", "Staff"), getReservationReportController);
router.get("/revenue", authenticate, requireRole("Admin"), getRevenueReportController);
router.get("/occupancy", authenticate, requireRole("Admin", "Staff"), getOccupancyReportController);
router.get("/tables", authenticate, requireRole("Admin", "Staff"), getTableReportController);

export default router;
