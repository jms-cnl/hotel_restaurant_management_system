import type { User } from "./types.ts";

export const role = (user: User | null) => user?.role?.role_name ?? "Customer";
export const isManager = (user: User | null) => ["Admin", "Staff"].includes(role(user));
export const isAdmin = (user: User | null) => role(user) === "Admin";
export const userName = (user: User | null) => [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Staff Member";
export const canCreateReservations = (user: User | null) => ["Customer", "Staff", "Admin"].includes(role(user));
export const landingPath = (user: User | null) => isManager(user) ? "/dashboard" : "/home";
