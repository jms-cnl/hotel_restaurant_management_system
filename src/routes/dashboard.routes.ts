import { Router } from "express";
import { getDashboardController } from "../controllers/dashboard.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, requireRole("Admin", "Staff"), getDashboardController);

export default router;
