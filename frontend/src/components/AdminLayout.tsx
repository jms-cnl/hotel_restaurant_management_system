import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { adminTabs } from "../adminTabs";
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
                    {adminTabs.map(tab => tab.render())}
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
