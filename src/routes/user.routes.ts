import { Router } from "express";
import { getCurrentUserController, updateCurrentUserController } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", getCurrentUserController);
router.put("/me", updateCurrentUserController);

export default router;
