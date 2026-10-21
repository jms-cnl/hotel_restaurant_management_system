import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const customerLinks = [
    ["Home", "/home"],
    ["Hotels", "/hotels"],
    ["Restaurants", "/restaurants"],
    ["Reservations", "/reservations"],
    ["Combined stay", "/combined-bookings"],
    ["Notifications", "/notifications"],
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
            <Link className="customer-logo" to="/home"><span className="customer-logo-icon">S</span> StayEase</Link>
            <nav className="customer-nav-links" aria-label="Customer navigation">
                {customerLinks.map(([label, path]) => <NavLink key={path} to={path} end={path === "/home"}>{label}</NavLink>)}
            </nav>
            <div className="customer-nav-actions">
                <NavLink className="customer-profile-link" to="/profile">{user?.first_name || "Account"}</NavLink>
                <button className="customer-signout-button" type="button" onClick={() => void signOut()}>Sign out</button>
            </div>
        </header>
        <main className="customer-main">{children}</main>
        <footer className="customer-footer">StayEase · Hotel and restaurant reservations</footer>
    </div>;
}
