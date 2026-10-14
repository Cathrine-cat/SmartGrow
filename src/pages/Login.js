
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function Login() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <p>Loading...</p>;
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  auth.signinRedirect();

  /*return (
    <main className="login-page">
      <section className="login-card">
        <Link to="/">← Back to homepage</Link>

        <h1>Welcome back</h1>
        <p>Sign in to manage your irrigation system.</p> 

        {auth.error && (
          <p role="alert">
            {auth.error.message}
          </p>
        )}

        <button
          type="button"
          onClick={() => auth.signinRedirect()}
        >
          Sign in with email
        </button>
      </section>
    </main>
  );*/
}
