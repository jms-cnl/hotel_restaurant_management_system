
import { useState, type FormEvent } from 'react';
import '../App.css';

type ProfileTab = 'info' | 'password' | 'activity';

export default function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('info');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(
    sessionStorage.getItem('stayeaseDemoName') || 'James Whitfield'
  );
  const [email, setEmail] = useState(
    sessionStorage.getItem('stayeaseDemoEmail') || 'guest@lumina.com'
  );
  const [phone, setPhone] = useState('+1 (212) 555-0142');
  const [bio, setBio] = useState(
    'Frequent traveler. Passionate about great food and exceptional hotel experiences.'
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');

  function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    sessionStorage.setItem('stayeaseDemoName', name);
    sessionStorage.setItem('stayeaseDemoEmail', email);

    setEditing(false);
    setNotice('Profile updated for this demo session.');
  }

  function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setNotice('Your new password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice('The new passwords do not match.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNotice(
      'Password form validated. Connect this action to your backend to change the real password.'
    );
  }

  return (
    <main className="customer-profile-page">
      <div className="customer-profile-container">
        {/* Customer overview */}
        <section className="profile-overview-card">
          <div className="profile-avatar">
            {name.trim().charAt(0).toUpperCase() || 'C'}
          </div>

          <div className="profile-overview-info">
            <div className="profile-name-line">
              <h1>{name}</h1>
              <span className="profile-role-badge">Customer</span>
            </div>

            <p className="profile-email">{email}</p>
            <p className="profile-bio">{bio}</p>
            <p className="profile-member-since">Member since March 2024</p>
          </div>

          <div className="profile-quick-stats">
            <div>
              <strong>2</strong>
              <span>Hotel Stays</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Dining</span>
            </div>
            <div>
              <strong>1</strong>
              <span>Combined</span>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="profile-stats-grid">
          <article className="profile-stat-card">
            <p>Upcoming Reservations</p>
            <strong className="stat-green">4</strong>
          </article>

          <article className="profile-stat-card">
            <p>Total Spent (Hotels)</p>
            <strong className="stat-gold">₱3,040</strong>
          </article>

          <article className="profile-stat-card">
            <p>Completed Stays</p>
            <strong className="stat-muted">0</strong>
          </article>
        </section>

        {/* Tabs */}
        <nav className="profile-tabs" aria-label="Profile sections">
          <button
            type="button"
            className={activeTab === 'info' ? 'active' : ''}
            onClick={() => {
              setActiveTab('info');
              setNotice('');
            }}
          >
            Profile Info
          </button>

          <button
            type="button"
            className={activeTab === 'password' ? 'active' : ''}
            onClick={() => {
              setActiveTab('password');
              setNotice('');
            }}
          >
            Change Password
          </button>

          <button
            type="button"
            className={activeTab === 'activity' ? 'active' : ''}
            onClick={() => {
              setActiveTab('activity');
              setNotice('');
            }}
          >
            Activity
          </button>
        </nav>

        {/* Profile information */}
        {activeTab === 'info' && (
          <section className="profile-content-card">
            <div className="profile-section-heading">
              <h2>Profile Information</h2>

              <button
                type="button"
                className="profile-outline-button"
                onClick={() => {
                  setEditing(!editing);
                  setNotice('');
                }}
              >
                {editing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {editing ? (
              <form
                className="profile-edit-form"
                onSubmit={handleProfileSave}
              >
                <label>
                  Full Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Email Address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>

                <label>
                  About Me
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    rows={3}
                  />
                </label>

                <button type="submit" className="profile-primary-button">
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="profile-information-grid">
                <div>
                  <span>Full Name</span>
                  <p>{name}</p>
                </div>

                <div>
                  <span>Email Address</span>
                  <p>{email}</p>
                </div>

                <div>
                  <span>Phone Number</span>
                  <p>{phone || 'Not provided'}</p>
                </div>

                <div>
                  <span>Account Type</span>
                  <p className="profile-muted-value">Customer</p>
                </div>

                <div>
                  <span>Member Since</span>
                  <p>March 2024</p>
                </div>

                <div>
                  <span>Account ID</span>
                  <p className="profile-muted-value">U1</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Change password */}
        {activeTab === 'password' && (
          <section className="profile-content-card">
            <div className="profile-section-heading">
              <h2>Change Password</h2>
            </div>

            <form
              className="profile-edit-form profile-password-form"
              onSubmit={handlePasswordChange}
            >
              <label>
                Current Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Confirm New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                />
              </label>

              <button type="submit" className="profile-primary-button">
                Update Password
              </button>
            </form>
          </section>
        )}

        {/* Activity */}
        {activeTab === 'activity' && (
          <section className="profile-content-card">
            <div className="profile-section-heading">
              <h2>Recent Activity</h2>
            </div>

            <div className="profile-activity-list">
              <article>
                <span className="profile-activity-icon">H</span>
                <div>
                  <h3>Hotel booking activity</h3>
                  <p>Your hotel reservation activity will appear here.</p>
                </div>
                <span className="profile-activity-status">Demo</span>
              </article>

              <article>
                <span className="profile-activity-icon">D</span>
                <div>
                  <h3>Dining reservation activity</h3>
                  <p>Your restaurant reservations will appear here.</p>
                </div>
                <span className="profile-activity-status">Demo</span>
              </article>

              <article>
                <span className="profile-activity-icon">C</span>
                <div>
                  <h3>Combined stay activity</h3>
                  <p>Your combined hotel and dining plans will appear here.</p>
                </div>
                <span className="profile-activity-status">Demo</span>
              </article>
            </div>
          </section>
        )}

        {notice && (
          <p className="profile-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}