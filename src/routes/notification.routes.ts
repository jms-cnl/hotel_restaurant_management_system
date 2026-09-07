import { Router } from "express";
import {
    getNotificationsController,
    markNotificationAsReadController
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", getNotificationsController);
router.patch("/:id/read", markNotificationAsReadController);

export default router;
