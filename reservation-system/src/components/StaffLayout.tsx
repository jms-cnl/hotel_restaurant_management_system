
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../App.css';

export default function StaffLayout() {
  const navigate = useNavigate();

  const staffName =
  sessionStorage.getItem('stayeaseDemoName') || 'Staff Member';

const staffRole =
  sessionStorage.getItem('stayeaseDemoRole') === 'staff'
    ? 'Staff'
    : 'Customer';

  function handleSignOut() {
    const confirmed = window.confirm('Are you sure you want to sign out?');

    if (!confirmed) return;

    sessionStorage.removeItem('stayeaseDemoLoggedIn');
    sessionStorage.removeItem('stayeaseDemoEmail');
    sessionStorage.removeItem('stayeaseDemoName');
    sessionStorage.removeItem('stayeaseDemoRole');

    window.dispatchEvent(new Event('stayease-auth-change'));
    navigate('/login');
  }

  return (
    <div className="customer-app">
      <header className="customer-navbar">
        <Link to="/staff/dashboard" className="customer-logo">
          <span className="customer-logo-icon">L</span>
          <span>StayEase</span>
        </Link>

        <nav className="customer-nav-links">
  <NavLink to="/staff/dashboard">
    Dashboard
  </NavLink>

  <NavLink to="/staff" end>
    Hotels &amp; Restaurants
  </NavLink>

  <NavLink to="/staff/reservations">
    Reservations
  </NavLink>

  <NavLink to="/staff/manage">
    Manage
  </NavLink>
</nav>

        <div className="customer-nav-actions">
          <NavLink to="/staff/profile" className="customer-profile-link">
  {staffName}
  <span className="staff-role-label">{staffRole}</span>
</NavLink>

          <NavLink to="/staff/profile" className="customer-profile-link">
            My Profile
          </NavLink>

          <button
            type="button"
            className="customer-signout-button"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
