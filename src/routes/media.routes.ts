import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { getRequestSupabase } from "../config/supabase.js";
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

const requireMediaWriteRole = (req: Request, res: Response, next: NextFunction) => {
    const roleGuard = req.params.entityType === "hotel"
        ? requireRole("Admin")
        : requireRole("Admin", "Staff");
    roleGuard(req, res, next);
};

const requireAdminForHotelMedia = async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.roleName.toLowerCase() !== "staff") {
        next();
        return;
    }

    const mediaId = Number(req.params.id);
    if (!Number.isInteger(mediaId) || mediaId <= 0) {
        next();
        return;
    }

    try {
        const { data, error } = await getRequestSupabase(req)
            .from("media")
            .select("hotel_id")
            .eq("media_id", mediaId)
            .maybeSingle();
        if (error) throw error;
        if (data?.hotel_id !== null && data?.hotel_id !== undefined) {
            res.status(403).json({ message: "Insufficient permissions" });
            return;
        }
        next();
    } catch {
        res.status(500).json({ message: "Unable to verify media permissions" });
    }
};

router.use(authenticate);
router.get("/:entityType/:entityId", getMediaController);
router.post("/:entityType/:entityId", requireMediaWriteRole, parseUpload, uploadMediaController);
router.put("/:id/file", requireRole("Admin", "Staff"), requireAdminForHotelMedia, parseUpload, replaceMediaController);
router.patch("/:id/primary", requireRole("Admin", "Staff"), requireAdminForHotelMedia, setPrimaryMediaController);
router.patch("/:id/order", requireRole("Admin", "Staff"), requireAdminForHotelMedia, updateMediaOrderController);
router.delete("/:id", requireRole("Admin", "Staff"), requireAdminForHotelMedia, deleteMediaController);

export default router;
