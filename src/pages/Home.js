
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function Home() {
  const auth = useAuth();

  return (
    <main className="home-page">
      <nav>
        <Link to="/">SmartGrow</Link>

        {auth.isAuthenticated ? (
          <Link to="/dashboard">Dashboard</Link>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>

      <section className="hero">
        <h1>Smarter irrigation. Healthier plants.</h1>

        <p>
          Monitor soil moisture, track environmental
          conditions, and manage watering in one place.
        </p>

        {auth.isAuthenticated ? (
          <Link to="/dashboard">Open dashboard</Link>
        ) : (
          <Link to="/login">Sign in to get started</Link>
        )}
      </section>

      <section>
        <h2>Features</h2>
        <p>Monitor live sensor readings.</p>
        <p>Manage automatic and manual watering.</p>
        <p>Explore historical sensor data.</p>
      </section>
    </main>
  );
}
