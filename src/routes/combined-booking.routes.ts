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

const router = Router();

router.get("/", getCombinedBookingsController);
router.post("/", createCombinedBookingController);
router.post("/hotel-restaurant", createHotelRestaurantCombinedBookingController);
router.get("/:id/reservations", getCombinedBookingReservationsController);
router.patch("/:id/status", changeCombinedBookingStatusController);
router.get("/:id", getCombinedBookingByIdController);
router.put("/:id", updateCombinedBookingController);
router.delete("/:id", deleteCombinedBookingController);

export default router;
