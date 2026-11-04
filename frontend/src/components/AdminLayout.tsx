import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import "../admin-theme.css";

const role = (user: ReturnType<typeof useAuth>["user"]) => user?.role?.role_name ?? "Staff";
const userName = (user: ReturnType<typeof useAuth>["user"]) =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Administrator";

export function AdminLayout({ children, warning }: { children: ReactNode; warning?: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function signOut() {
        if (!window.confirm("Are you sure you want to sign out?")) return;
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <div className="customer-app admin-app">
            <header className="customer-navbar">
                <Link to="/dashboard" className="customer-logo">
                    <span className="customer-logo-icon">S</span>
                    <span>Serenity</span>
                </Link>

                <nav className="customer-nav-links admin-nav-links" aria-label="Admin navigation">
                    <NavLink to="/dashboard">Dashboard</NavLink>
                    <NavLink to="/manage">Manage</NavLink>
                    <NavLink to="/reservations">Reservations</NavLink>
                    <NavLink to="/combined-bookings">Combined Bookings</NavLink>
                    <NavLink to="/hotels">Hotels</NavLink>
                    <NavLink to="/restaurants">Restaurants</NavLink>
                    <NavLink to="/rooms">Rooms</NavLink>
                    <NavLink to="/tables">Tables</NavLink>
                    <NavLink to="/amenities">Amenities</NavLink>
                    <NavLink to="/users">Users &amp; Staff Assignments</NavLink>
                    <NavLink to="/reports">Reports</NavLink>
                    <NavLink to="/notifications" aria-label="Notifications">🔔</NavLink>
                </nav>

                <div className="customer-nav-actions">
                    <NavLink to="/profile" className="customer-profile-link" aria-label={`Profile for ${userName(user)}`} title={userName(user)}>
                        {userName(user)}<span className="staff-role-label">{role(user)}</span>
                    </NavLink>
                    <button type="button" className="customer-signout-button" onClick={() => void signOut()}>
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="customer-main">{warning}{children}</main>
        </div>
    );
}
