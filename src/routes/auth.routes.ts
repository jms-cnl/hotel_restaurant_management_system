import { Router } from "express";
import {
    changePasswordController, forgotPasswordController, loginController, logoutController,
    csrfController, recoveryCsrfController, recoveryExchangeController, recoverySessionController,
    registerController, resetPasswordController, sessionStatusController
} from "../controllers/auth.controller.js";
import {
    authenticate, authenticateBootstrap, authenticateLogout, authenticateRecovery, authenticateRecoveryBootstrap, requireRecoverySession
} from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/csrf.middleware.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/session", authenticate, sessionStatusController);
router.post("/csrf", requireTrustedOrigin, authenticateBootstrap, csrfController);
router.post("/logout", authenticateLogout, logoutController);
router.post("/change-password", authenticate, changePasswordController);
router.post("/forgot-password", forgotPasswordController);
router.post("/recovery/exchange", requireTrustedOrigin, recoveryExchangeController);
router.get("/recovery/session", authenticateRecovery, requireRecoverySession, recoverySessionController);
router.post("/recovery/csrf", requireTrustedOrigin, authenticateRecoveryBootstrap, requireRecoverySession, recoveryCsrfController);
router.post("/reset-password", authenticateRecovery, requireRecoverySession, resetPasswordController);

export default router;
