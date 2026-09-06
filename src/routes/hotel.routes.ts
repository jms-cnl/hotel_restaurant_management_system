import { Router } from "express";
import {
    getHotelsController,
    getHotelByIdController,
    createHotelController,
    updateHotelController,
    deleteHotelController
} from "../controllers/hotel.controller.js";

const router = Router();

router.get("/", getHotelsController);
router.get("/:id", getHotelByIdController);
router.post("/", createHotelController);
router.put("/:id", updateHotelController);
router.delete("/:id", deleteHotelController);

export default router;