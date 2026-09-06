import { Router } from "express";
import {
    getRestaurantsController,
    getRestaurantByIdController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController
} from "../controllers/restaurant.controller.js";

const router = Router();

router.get("/", getRestaurantsController);
router.get("/:id", getRestaurantByIdController);
router.post("/", createRestaurantController);
router.put("/:id", updateRestaurantController);
router.delete("/:id", deleteRestaurantController);

export default router;
