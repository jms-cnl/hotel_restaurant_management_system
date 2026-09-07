import { Router } from "express";
import {
    getReservationsController,
    getReservationByIdController,
    createReservationController,
    updateReservationController,
    deleteReservationController,
    changeReservationStatusController,
    getReservationHistoryController
} from "../controllers/reservation.controller.js";
import { authenticate, requireOwnedRecord, requireRole, requireSelfPayload, scopeToAuthenticatedUser } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", scopeToAuthenticatedUser, getReservationsController);
router.get("/:id", requireOwnedRecord("reservation"), getReservationByIdController);
router.post("/", requireSelfPayload, createReservationController);
router.put("/:id", requireOwnedRecord("reservation"), requireSelfPayload, updateReservationController);
router.delete("/:id", requireOwnedRecord("reservation"), deleteReservationController);
router.patch("/:id/status", requireRole("Admin", "Staff"), changeReservationStatusController);
router.get("/:id/history", requireOwnedRecord("reservation"), getReservationHistoryController);

export default router;
