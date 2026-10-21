import { Router } from "express";
import {
    changeCombinedBookingStatusController,
    createCombinedBookingController,
    createHotelRestaurantCombinedBookingController,
    deleteCombinedBookingController,
    getCombinedBookingByIdController,
    getCombinedBookingReservationsController,
    getCombinedBookingsController,
    updateCombinedBookingController
} from "../controllers/combined-booking.controller.js";
import { authenticate, requireOwnedRecord, requireRole, requireSelfPayload, scopeToAuthenticatedUser } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", scopeToAuthenticatedUser, getCombinedBookingsController);
router.post("/", requireRole("Customer", "Staff", "Admin"), requireSelfPayload, createCombinedBookingController);
router.post("/hotel-restaurant", requireRole("Customer", "Staff", "Admin"), requireSelfPayload, createHotelRestaurantCombinedBookingController);
router.get("/:id/reservations", requireOwnedRecord("combined_booking"), getCombinedBookingReservationsController);
router.patch("/:id/status", requireRole("Admin", "Staff"), changeCombinedBookingStatusController);
router.get("/:id", requireOwnedRecord("combined_booking"), getCombinedBookingByIdController);
router.put("/:id", requireOwnedRecord("combined_booking"), requireSelfPayload, updateCombinedBookingController);
router.delete("/:id", requireOwnedRecord("combined_booking"), deleteCombinedBookingController);

export default router;
