
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../App.css';

type CustomerLayoutProps = {
  loggedIn: boolean;
};

function CustomerLayout({ loggedIn }: CustomerLayoutProps) {
  const navigate = useNavigate();

  function handleSignOut() {
    const confirmed = window.confirm('Are you sure you want to sign out?');

    if (!confirmed) return;

    sessionStorage.removeItem('stayeaseDemoLoggedIn');
    sessionStorage.removeItem('stayeaseDemoEmail');
    sessionStorage.removeItem('stayeaseDemoName');

    window.dispatchEvent(new Event('stayease-auth-change'));
    navigate('/');
  }

  return (
    <div className="customer-app">
      <header className="customer-navbar">
        <Link to="/" className="customer-logo">
          <span className="customer-logo-icon">L</span>
          <span>StayEase</span>
        </Link>

        <nav className="customer-nav-links">
          <NavLink to="/" end>
            Hotels &amp; Restaurants
          </NavLink>

          {loggedIn && (
            <NavLink to="/reservations">
              My Reservations
            </NavLink>
          )}
        </nav>

        <div className="customer-nav-actions">
          {loggedIn ? (
            <>
              <NavLink
                to="/notifications"
                className="notification-link"
                aria-label="Notifications"
                title="Notifications"
              >
                🔔
              </NavLink>

              <NavLink to="/profile" className="customer-profile-link">
                My Profile
              </NavLink>

              <button
                type="button"
                className="customer-signout-button"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="customer-profile-link">
                Log In
              </Link>

              <Link to="/register" className="customer-signout-button">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}

export default CustomerLayout;
