import { Router } from "express";
import {
    getNotificationsController,
    markNotificationAsReadController
} from "../controllers/notification.controller.js";

const router = Router();

router.get("/", getNotificationsController);
router.patch("/:id/read", markNotificationAsReadController);

export default router;
