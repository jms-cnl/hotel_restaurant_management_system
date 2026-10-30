const customerIdleTimeoutMs = 30 * 60 * 1000;
const staffIdleTimeoutMs = 15 * 60 * 1000;

export const sessionIdleTimeoutForRoleMs = (roleName: string): number => {
    switch (roleName.trim().toLowerCase()) {
        case "customer": return customerIdleTimeoutMs;
        case "staff":
        case "admin": return staffIdleTimeoutMs;
        default: throw new Error("Cannot create or extend a session for an unknown role");
    }
};

export const isSessionIdleExpiredForRole = (lastActivityAt: string, roleName: string, nowAt = new Date()) => {
    const lastActivity = Date.parse(lastActivityAt);
    if (!Number.isFinite(lastActivity) || !Number.isFinite(nowAt.getTime())) {
        throw new Error("Invalid session activity timestamp");
    }
    return nowAt.getTime() >= lastActivity + sessionIdleTimeoutForRoleMs(roleName);
};
