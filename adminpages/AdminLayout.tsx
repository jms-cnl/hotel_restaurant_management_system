import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../App.css';

function AdminLayout() {
  const navigate = useNavigate();

  const adminName =
    sessionStorage.getItem('stayeaseDemoName') || 'Administrator';

  function signOut() {
    if (!window.confirm('Are you sure you want to sign out?')) return;

    [
      'stayeaseDemoLoggedIn',
      'stayeaseDemoEmail',
      'stayeaseDemoName',
      'stayeaseDemoRole',
    ].forEach((key) => sessionStorage.removeItem(key));

    window.dispatchEvent(new Event('stayease-auth-change'));

    navigate('/login');
  }

  return (
    <div className="customer-app admin-app">
      <header className="customer-navbar">
        <Link to="/admin/dashboard" className="customer-logo">
          <span className="customer-logo-icon">S</span>
          <span>Serenity</span>
        </Link>

        <nav className="customer-nav-links admin-nav-links">
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/rooms-tables">Rooms &amp; Tables</NavLink>
          <NavLink to="/admin/manage">Manage</NavLink>
          <NavLink to="/admin/support">Customer Support</NavLink>
          <NavLink to="/admin/notifications">🔔</NavLink>
        </nav>

        <div className="customer-nav-actions">
          <NavLink
            to="/admin/profile"
            className="customer-profile-link"
          >
            {adminName}
            <span className="staff-role-label">Admin</span>
          </NavLink>

          <button
            type="button"
            className="customer-signout-button"
            onClick={signOut}
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

export default AdminLayout;
