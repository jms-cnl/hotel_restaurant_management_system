import { Router } from "express";
import {
    changeReservationStatusController,
    createReservationController,
    deleteReservationController,
    getReservationByIdController,
    getReservationHistoryController,
    getReservationsController,
    updateReservationController
} from "../controllers/reservation.controller.js";

const router = Router();

router.get("/", getReservationsController);
router.get("/:id", getReservationByIdController);
router.post("/", createReservationController);
router.put("/:id", updateReservationController);
router.delete("/:id", deleteReservationController);
router.patch("/:id/status", changeReservationStatusController);
router.get("/:id/history", getReservationHistoryController);

export default router;
