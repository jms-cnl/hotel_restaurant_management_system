import type { Request, Response } from "express";
import { getCurrentUserProfile, updateCurrentUserProfile } from "../services/user.service.js";

const profileFieldLimits = { first_name: 100, last_name: 100, phone: 30 } as const;
type ProfileField = keyof typeof profileFieldLimits;

const validateProfileUpdate = (body: unknown): { profile?: Record<ProfileField, string>; error?: string } => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Profile update body must be a JSON object" };
    }

    const entries = Object.entries(body);
    if (entries.length === 0) return { error: "Profile update must include at least one field" };

    const allowed = new Set<string>(Object.keys(profileFieldLimits));
    const unexpected = entries.map(([key]) => key).filter((key) => !allowed.has(key));
    if (unexpected.length > 0) return { error: `Profile update contains fields that are not allowed: ${unexpected.join(", ")}` };

    const profile: Partial<Record<ProfileField, string>> = {};
    for (const [key, value] of entries) {
        if (typeof value !== "string") return { error: `Profile field '${key}' must be a string` };
        const field = key as ProfileField;
        const trimmed = value.trim();
        if ((field === "first_name" || field === "last_name") && trimmed.length === 0) {
            return { error: `Profile field '${field}' cannot be empty` };
        }
        if (trimmed.length > profileFieldLimits[field]) {
            return { error: `Profile field '${field}' must be ${profileFieldLimits[field]} characters or fewer` };
        }
        profile[field] = trimmed;
    }

    return { profile: profile as Record<ProfileField, string> };
};

export const getCurrentUserController = async (req: Request, res: Response) => {
    try {
        const profile = await getCurrentUserProfile(req);

        res.json(profile);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to retrieve current user profile",
            error: error
        });
    }
};

export const updateCurrentUserController = async (req: Request, res: Response) => {
    const validation = validateProfileUpdate(req.body);
    if (validation.error || !validation.profile) {
        res.status(400).json({ message: validation.error ?? "Invalid profile update" });
        return;
    }

    try {
        const profile = await updateCurrentUserProfile(req, validation.profile);

        res.json(profile);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to update current user profile",
            error: error
        });
    }
};
