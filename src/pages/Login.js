
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const initialForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
};

export default function Login() {
  const { user, login, register, confirmRegistration, resendConfirmationCode } = useAuth();
  const [mode, setMode] = useState("login");
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (confirmingEmail) {
        await confirmRegistration(form.email, confirmationCode);
        setConfirmingEmail(false);
        setMode("login");
        setMessage("Email verified. You can now sign in with your email and password.");
      } else if (mode === "login") {
        const result = await login(form.email, form.password);
        if (result?.needsConfirmation) {
          setConfirmingEmail(true);
          setMessage("This account needs email verification. Enter the code we sent you.");
        }
      } else {
        const result = await register(form);
        if (result.nextStep?.signUpStep === "CONFIRM_SIGN_UP") {
          setConfirmingEmail(true);
          setMessage("We sent a verification code to your email address.");
        }
      }
    } catch (submitError) {
      const alreadyConfirmed =
        submitError.name === "UserAlreadyConfirmedException" ||
        (submitError.name === "NotAuthorizedException" &&
          /current status is confirmed/i.test(submitError.message || ""));

      if (confirmingEmail && alreadyConfirmed) {
        setConfirmingEmail(false);
        setMode("login");
        setMessage("Your email is already verified. Sign in with your email and password.");
      } else {
        setError(submitError.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">← Back to homepage</Link>

        {!confirmingEmail && <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "login" ? "toggle active" : "toggle"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "toggle active" : "toggle"}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>}

        <h1>{confirmingEmail ? "Verify your email" : mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {confirmingEmail
            ? `Enter the code we sent to ${form.email}.`
            : mode === "login"
            ? "Sign in to manage your irrigation system."
            : "Set up your profile and start monitoring your devices."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!confirmingEmail && mode === "signup" && (
            <>
              <label>
                <span>Name</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                />
              </label>
            </>
          )}

          {!confirmingEmail && <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </label>}

          {!confirmingEmail && mode === "signup" && (
            <label>
              <span>Phone</span>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Optional"
              />
            </label>
          )}

          {!confirmingEmail && <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </label>}

          {confirmingEmail && <label>
            <span>Email verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              placeholder="Enter the code from your email"
              required
            />
          </label>}

          {error && <p className="error-box" role="alert">{error}</p>}
          {message && <p className="success-text" role="status">{message}</p>}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Please wait..." : confirmingEmail ? "Verify email" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        {confirmingEmail && <button
          type="button"
          className="ghost-button device-link"
          disabled={loading}
          onClick={async () => {
            setError("");
            setMessage("");
            setLoading(true);
            try {
              await resendConfirmationCode(form.email);
              setMessage("A new verification code has been sent.");
            } catch (resendError) {
              setError(resendError.message || "Could not resend the code.");
            } finally {
              setLoading(false);
            }
          }}
        >Resend code</button>}
      </div>
    </main>
  );
}
