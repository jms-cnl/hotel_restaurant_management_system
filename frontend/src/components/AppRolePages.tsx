import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { isAdmin, isManager, landingPath } from "../appAccess";
import type { User } from "../types";
import { AdminDashboard } from "./AdminPages";
import { CustomerHome } from "./CustomerHome";
import { StaffDashboardPage } from "./StaffDashboardPage";

export const dashboardForUser = (user: User | null) =>
    isAdmin(user) ? <AdminDashboard /> : <StaffDashboardPage user={user} />;

export function Dashboard() {
    const { user } = useAuth();
    return dashboardForUser(user);
}

export const homeForUser = (user: User | null) =>
    isManager(user) ? <Navigate to="/dashboard" replace /> : <CustomerHome />;

export function Home() {
    const { user } = useAuth();
    return homeForUser(user);
}

export const landingRedirectForUser = (user: User | null) =>
    <Navigate to={landingPath(user)} replace />;

export function LandingRedirect() {
    const { user } = useAuth();
    return landingRedirectForUser(user);
}
