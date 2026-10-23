
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    // Frontend demo only. The backend must verify real roles.
    sessionStorage.setItem("stayeaseDemoLoggedIn", "true");
    sessionStorage.setItem("stayeaseDemoEmail", email.trim());
    sessionStorage.setItem("stayeaseDemoRole", role);

    window.dispatchEvent(new Event("stayease-auth-change"));

    if (role === "staff") {
      navigate("/staff/dashboard");
    } else {
      navigate("/");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand">
          StayEase
        </Link>

        <p className="auth-eyebrow">WELCOME BACK</p>
        <h1>Log in to StayEase</h1>

        <p className="auth-description">
          Access your reservations and account.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="loginEmail">Email address</label>
          <input
            id="loginEmail"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label htmlFor="loginRole">Demo account type</label>
          <select
            id="loginRole"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
          </select>

          {error && <p role="alert">{error}</p>}

          <button type="submit" className="auth-button">
            Log In
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <Link to="/" className="auth-home-link">
          Back to Home
        </Link>

        <p className="auth-description">
          Demo mode: use any valid email format and a password to preview
          the selected interface. This does not verify account credentials
          or staff permissions.
        </p>
      </section>
    </main>
  );
}
