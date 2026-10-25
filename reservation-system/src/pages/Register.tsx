
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    // Temporary frontend-only demo registration.
    // Real account creation will be handled by the backend.
    sessionStorage.setItem("stayeaseDemoLoggedIn", "true");
    sessionStorage.setItem("stayeaseDemoEmail", email.trim());
    sessionStorage.setItem("stayeaseDemoName", fullName.trim());

    window.dispatchEvent(new Event("stayease-auth-change"));

    navigate("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand">
          StayEase
        </Link>

        <p className="auth-eyebrow">JOIN STAYEASE</p>
        <h1>Create your account</h1>
        <p className="auth-description">
          Sign up to discover places to stay and dine.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="registerEmail">Email address</label>
          <input
            id="registerEmail"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="registerPassword">Password</label>
          <input
            id="registerPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />

          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />

          <p className="auth-note">
            New accounts are registered as Customers.
          </p>

          <button type="submit" className="auth-button">
            Create Account
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>

        <Link to="/" className="auth-home-link">
          Back to Homepage
        </Link>
      </section>
    </main>
  );
}
