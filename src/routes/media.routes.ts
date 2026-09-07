import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import {
    deleteMediaController,
    getMediaController,
    replaceMediaController,
    setPrimaryMediaController,
    updateMediaOrderController,
    uploadMediaController
} from "../controllers/media.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const parseUpload = (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (error: unknown) => {
        if (!error) { next(); return; }
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ message: "Image must be 5 MB or smaller" });
            return;
        }
        res.status(400).json({ message: "Invalid image upload" });
    });
};

router.use(authenticate);
router.get("/:entityType/:entityId", getMediaController);
router.post("/:entityType/:entityId", requireRole("Admin", "Staff"), parseUpload, uploadMediaController);
router.put("/:id/file", requireRole("Admin", "Staff"), parseUpload, replaceMediaController);
router.patch("/:id/primary", requireRole("Admin", "Staff"), setPrimaryMediaController);
router.patch("/:id/order", requireRole("Admin", "Staff"), updateMediaOrderController);
router.delete("/:id", requireRole("Admin", "Staff"), deleteMediaController);

export default router;
