export const staffNavigationItems = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Rooms", to: "/rooms" },
    { label: "Tables", to: "/tables" },
    { label: "Reservations", to: "/reservations" },
    { label: "Manage", to: "/manage" },
] as const;

export const staffAccountLinks = [
    { label: "Notifications", to: "/notifications" },
    { label: "My Profile", to: "/profile" },
] as const;

const staffPropertyListPaths = new Set(["/properties", "/hotels", "/restaurants"]);
const staffPropertyDetailPath = /^\/(?:hotels|restaurants)\/[^/]+$/;

export const staffRedirectForPath = (pathname: string) => {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    return staffPropertyListPaths.has(normalizedPath) || staffPropertyDetailPath.test(normalizedPath)
        ? "/dashboard"
        : null;
};
