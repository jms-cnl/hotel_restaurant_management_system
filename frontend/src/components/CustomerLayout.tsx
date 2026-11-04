import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const customerLinks = [
    ["Hotels & Restaurants", "/home"],
    ["My Reservations", "/reservations"],
] as const;

export function CustomerLayout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const signOut = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return <div className="customer-app">
        <header className="customer-navbar">
            <Link className="customer-logo" to="/home"><span className="customer-logo-icon">L</span><span>StayEase</span></Link>
            <nav className="customer-nav-links" aria-label="Customer navigation">
                {customerLinks.map(([label, path]) => <NavLink key={path} to={path} end={path === "/home"}>{label}</NavLink>)}
            </nav>
            <div className="customer-nav-actions">
                <NavLink className="notification-link" to="/notifications" aria-label="Notifications" title="Notifications">🔔</NavLink>
                <NavLink className="customer-profile-link" to="/profile">My Profile</NavLink>
                <button className="customer-signout-button" type="button" onClick={() => void signOut()}>Sign out</button>
            </div>
        </header>
        <main className="customer-main">{children}</main>
    </div>;
}
