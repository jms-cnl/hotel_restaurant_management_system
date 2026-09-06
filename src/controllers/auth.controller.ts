import type { Request, Response } from "express";
import { loginUser, logoutUser, registerUser } from "../services/auth.service.js";

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
