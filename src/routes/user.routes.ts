import { Router } from "express";
import { getCurrentUserController, updateCurrentUserController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", authenticate, getCurrentUserController);
router.put("/me", authenticate, updateCurrentUserController);

export default router;
