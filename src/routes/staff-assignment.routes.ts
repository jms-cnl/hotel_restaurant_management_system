import { Router } from "express";
import {
    createStaffAssignmentController,
    deleteStaffAssignmentController,
    getStaffAssignmentsController
} from "../controllers/staff-assignment.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();
export const requireStaffAssignmentAdmin = requireRole("Admin");

router.use(authenticate, requireStaffAssignmentAdmin);
router.get("/", getStaffAssignmentsController);
router.post("/", createStaffAssignmentController);
router.delete("/:userId/:restaurantId", deleteStaffAssignmentController);

export default router;
