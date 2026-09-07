import { Router } from "express";
import { changePasswordController, forgotPasswordController, loginController, logoutController, registerController, resetPasswordController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/logout", authenticate, logoutController);
router.post("/change-password", authenticate, changePasswordController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", authenticate, resetPasswordController);

export default router;
