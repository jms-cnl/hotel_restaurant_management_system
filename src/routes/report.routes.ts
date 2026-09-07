import { Router } from "express";
import {
    getOccupancyReportController,
    getReservationReportController,
    getRevenueReportController
} from "../controllers/report.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate, requireRole("Admin", "Staff"));
router.get("/reservations", getReservationReportController);
router.get("/revenue", getRevenueReportController);
router.get("/occupancy", getOccupancyReportController);

export default router;
