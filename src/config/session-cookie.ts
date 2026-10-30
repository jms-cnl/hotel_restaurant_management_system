export const SESSION_COOKIE_NAME = "hrm_session";

export const sessionCookieOptions = (maxAge?: number) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || cookieSameSite() === "none",
    sameSite: cookieSameSite(),
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge })
});

const cookieSameSite = (): "strict" | "lax" | "none" => {
    const configured = process.env.HRMS_SESSION_COOKIE_SAME_SITE?.trim().toLowerCase();
    if (configured === "strict" || configured === "lax" || configured === "none") return configured;
    if (configured) throw new Error("HRMS_SESSION_COOKIE_SAME_SITE must be strict, lax, or none");
    return process.env.NODE_ENV === "production" ? "none" : "lax";
};
