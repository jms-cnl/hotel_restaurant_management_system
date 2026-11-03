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
import {
    requireRestaurantAccess,
    restaurantIdsFromReservationBody,
    restaurantIdsFromReservationRecord,
    restaurantIdsFromReservationUpdate
} from "../middleware/restaurant-access.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", scopeToAuthenticatedUser, getReservationsController);
router.get("/:id", requireOwnedRecord("reservation"), requireRestaurantAccess(restaurantIdsFromReservationRecord), getReservationByIdController);
router.post("/", requireRole("Customer", "Staff", "Admin"), requireSelfPayload, requireRestaurantAccess(restaurantIdsFromReservationBody), createReservationController);
router.put("/:id", requireOwnedRecord("reservation"), requireSelfPayload, requireRestaurantAccess(restaurantIdsFromReservationUpdate), updateReservationController);
router.delete("/:id", requireOwnedRecord("reservation"), requireRestaurantAccess(restaurantIdsFromReservationRecord), deleteReservationController);
router.patch("/:id/status", requireRole("Admin", "Staff"), requireRestaurantAccess(restaurantIdsFromReservationRecord), changeReservationStatusController);
router.get("/:id/history", requireOwnedRecord("reservation"), requireRestaurantAccess(restaurantIdsFromReservationRecord), getReservationHistoryController);

export default router;
