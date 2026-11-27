import { Router } from "express";
import { submitSupportMessageController } from "../controllers/support-message.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.post("/", requireRole("Customer"), submitSupportMessageController);

export default router;
