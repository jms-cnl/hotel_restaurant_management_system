import { Router } from "express";
import { loginController, logoutController, registerController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/logout", authenticate, logoutController);

export default router;
