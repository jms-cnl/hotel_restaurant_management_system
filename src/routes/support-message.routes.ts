import { Router } from "express";
import {
    getSupportMessageController,
    listSupportMessagesController,
    submitSupportMessageController,
    updateSupportMessageStatusController,
} from "../controllers/support-message.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("Admin"), listSupportMessagesController);
router.get("/:id", requireRole("Admin"), getSupportMessageController);
router.patch("/:id/status", requireRole("Admin"), updateSupportMessageStatusController);
router.post("/", requireRole("Customer"), submitSupportMessageController);

export default router;
