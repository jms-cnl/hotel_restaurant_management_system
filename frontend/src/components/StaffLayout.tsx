import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { staffAccountLinks, staffNavigationItems } from "../staffNavigation";

const role = (user: ReturnType<typeof useAuth>["user"]) => user?.role?.role_name ?? "Staff";
const userName = (user: ReturnType<typeof useAuth>["user"]) =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Staff Member";

export function StaffLayout({ children, warning }: { children: ReactNode; warning?: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function signOut() {
        await logout();
        navigate("/login", { replace: true });
    }

    return <div className="manager-app customer-app">
        <header className="customer-navbar">
            <Link to="/dashboard" className="customer-logo">
                <span className="customer-logo-icon">L</span>
                <span>StayEase</span>
            </Link>
            <nav className="customer-nav-links" aria-label="Staff navigation">
                {staffNavigationItems.map((item) => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
            </nav>
            <div className="customer-nav-actions">
                <NavLink to="/profile" className="customer-profile-link">
                    {userName(user)}<span className="staff-role-label">{role(user)}</span>
                </NavLink>
                {staffAccountLinks.map((item) => <NavLink key={item.to} to={item.to} className="customer-profile-link">{item.label}</NavLink>)}
                <button type="button" className="customer-signout-button" onClick={() => void signOut()}>
                    Sign Out
                </button>
            </div>
        </header>
        <main className="customer-main">{warning}{children}</main>
    </div>;
}
