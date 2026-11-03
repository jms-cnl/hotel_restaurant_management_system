import { Router } from "express";
import { getAdminUsersController, updateAdminUserRoleController } from "../controllers/admin-user.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("Admin"), getAdminUsersController);
router.patch("/:userId/role", requireRole("Admin"), updateAdminUserRoleController);

export default router;
