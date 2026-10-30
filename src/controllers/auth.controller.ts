import type { Request, Response } from "express";
import {
    changePassword, exchangeRecoveryTokens, getSafeSessionStatus, loginUser, logoutUser,
    registerUser, requestPasswordReset, resetPassword, rotateSessionCsrf
} from "../services/auth.service.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../config/session-cookie.js";

export const setSessionCookie = (res: Response, result: Awaited<ReturnType<typeof loginUser>>) => {
    const issued = result.session;
    if (!issued) return;
    const maxAge = Math.max(0, Date.parse(issued.session.idleExpiresAt) - Date.now());
    res.cookie(SESSION_COOKIE_NAME, issued.cookieSecret, sessionCookieOptions(maxAge));
};

export const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());

export const safeAuthResponse = (result: Awaited<ReturnType<typeof loginUser>>) => ({
    user: result.user,
    profile: result.profile,
    session: result.session ? {
        purpose: result.session.session.purpose,
        scope: result.session.session.scope,
        idle_expires_at: result.session.session.idleExpiresAt
    } : null,
    csrf_token: result.session?.csrfToken ?? null
});

export const registerController = async (req: Request, res: Response) => {
    try {
        const result = await registerUser(req.body);
        setSessionCookie(res, result);
        res.status(201).json(safeAuthResponse(result));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to register user";
        res.status(400).json({ message });
    }
};

export const loginController = async (req: Request, res: Response) => {
    try {
        const result = await loginUser(req.body);
        setSessionCookie(res, result);
        res.json(safeAuthResponse(result));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to authenticate user";
        res.status(401).json({ message });
    }
};

export const recoveryExchangeController = async (req: Request, res: Response) => {
    try {
        const issued = await exchangeRecoveryTokens({ access_token: req.body.access_token, refresh_token: req.body.refresh_token });
        const result = { user: issued.user, profile: issued.profile, session: issued };
        setSessionCookie(res, result);
        res.json({ ...safeAuthResponse(result), session: { purpose: "recovery", scope: "password_reset", idle_expires_at: issued.session.idleExpiresAt } });
    } catch {
        res.status(401).json({ message: "Recovery link is invalid or expired" });
    }
};

export const recoverySessionController = async (req: Request, res: Response) => {
    try { res.json(await getSafeSessionStatus(req)); }
    catch { res.status(401).json({ message: "Recovery session is invalid or expired" }); }
};

export const recoveryCsrfController = async (req: Request, res: Response) => {
    try { res.json({ csrf_token: await rotateSessionCsrf(req) }); }
    catch { res.status(401).json({ message: "Recovery session is invalid or expired" }); }
};

export const csrfController = async (req: Request, res: Response) => {
    try { res.json({ csrf_token: await rotateSessionCsrf(req) }); }
    catch { res.status(401).json({ message: "Session is invalid or expired" }); }
};

export const sessionStatusController = async (req: Request, res: Response) => {
    try { res.json(await getSafeSessionStatus(req)); }
    catch { res.status(401).json({ message: "Session is invalid or expired" }); }
};

export const logoutController = async (req: Request, res: Response) => {
    try {
        await logoutUser(req);
        res.status(204).send();
    } catch {
        res.status(503).json({ message: "Unable to revoke the current session" });
    } finally {
        clearSessionCookie(res);
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
        await logoutUser(req);
        clearSessionCookie(res);
        res.json({ message: "Password reset successfully. Please sign in again." });
    } catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to reset password" });
    }
};
