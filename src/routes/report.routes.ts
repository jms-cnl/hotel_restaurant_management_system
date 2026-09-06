import { Router } from "express";
import {
    getOccupancyReportController,
    getReservationReportController,
    getRevenueReportController
} from "../controllers/report.controller.js";

const router = Router();

router.get("/reservations", getReservationReportController);
router.get("/revenue", getRevenueReportController);
router.get("/occupancy", getOccupancyReportController);

export default router;
