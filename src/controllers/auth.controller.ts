import type { Request, Response } from "express";
import { changePassword, loginUser, logoutUser, registerUser, requestPasswordReset, resetPassword } from "../services/auth.service.js";

export const registerController = async (req: Request, res: Response) => {
    try {
        const user = await registerUser(req.body);

        res.status(201).json(user);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to register user",
            error: error
        });
    }
};

export const loginController = async (req: Request, res: Response) => {
    try {
        const user = await loginUser(req.body);

        res.json(user);
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to authenticate user",
            error: error
        });
    }
};

export const logoutController = async (req: Request, res: Response) => {
    try {
        await logoutUser(req);

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(401).json({
            message: "Failed to log out user",
            error: error
        });
    }
};

export const changePasswordController = async (req: Request, res: Response) => {
    try {
        await changePassword(req, req.body.current_password, req.body.new_password);
        res.json({ message: "Password changed successfully" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to change password";
        res.status(message === "Current password is incorrect" ? 401 : 400).json({ message });
    }
};

export const forgotPasswordController = async (req: Request, res: Response) => {
    try {
        await requestPasswordReset(req.body.email);
        res.json({ message: "If the account exists, a password reset link has been sent" });
    } catch {
        res.status(400).json({ message: "Unable to request password reset" });
    }
};

export const resetPasswordController = async (req: Request, res: Response) => {
    try {
        await resetPassword(req, req.body.new_password);
        res.json({ message: "Password reset successfully" });
    } catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to reset password" });
    }
};
