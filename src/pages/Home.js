
import { Link, Navigate, useLocation } from "react-router-dom";
import { getDisplayName, useAuth } from "../auth/AuthContext";
import useDeviceCount from "../hooks/useDeviceCount";

export default function Home() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const deviceCount = useDeviceCount();

  if (loading) {
    return <p>Checking your login...</p>;
  }

  if (user && pathname === "/") {
    return <Navigate to="/app" replace />;
  }

  if (user) {
    const displayName = getDisplayName(user);

    return (
      <section className="content-page personal-home">
        <div className="page-header">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Hello, {displayName}.</h1>
          </div>
          <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Devices</span>
            <strong>{deviceCount}</strong>
          </div>
          <div className="stat-card">
            <span>Zone status</span>
            <strong>Healthy</strong>
          </div>
          <div className="stat-card">
            <span>Next action</span>
            <strong>Review reports</strong>
          </div>
        </div>

        <div className="panel-grid">
          <div className="info-panel">
            <h3>My irrigation overview</h3>
            <p>
              Your current system is operating normally. You can jump into the dashboard,
              manage your devices, or update your profile from the menu above.
            </p>
          </div>

          <div className="info-panel">
            <h3>Quick links</h3>
            <div className="quick-links">
              <Link to="/devices">Manage devices</Link>
              <Link to="/profile">Edit profile</Link>
              <Link to="/alerts">Check alerts</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <Link to="/" className="site-brand">
          <img className="brand-mark plant-logo" src="/images/plant.png" alt="" aria-hidden="true" />
          <span>SmartGrow</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/login" className="btn btn-secondary">Sign in</Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">A little more in tune with nature</p>
          <h1>Know what your garden needs.</h1>
          <p className="hero-text">
           Monitor soil moisture and environmental conditions,
            manage irrigation remotely, and understand your garden's history from one place.
          </p>

          <div className="cta-row">
            <Link to="/login?mode=register" className="btn btn-primary">Get started</Link>
            <Link to="/login" className="btn btn-secondary">Sign in</Link>
          </div>
          <p className="hero-footnote">Less guesswork. Happier plants. 🌱</p>
        </div>

        <div className="hero-visual">
          <img
            src="/images/garden-hero.svg"
            alt="A lush home garden growing in warm sunlight"
          />
        </div>
      </section>

      <section id="features" className="feature-section">
        <div className="section-heading">
          <p className="eyebrow">Made for your growing space</p>
          <h2>Everything your garden needs. All in one place.</h2>
          <p>Small, useful details that make plant care feel effortless.</p>
        </div>

        <div className="feature-grid">
          <article className="feature-card feature-with-image">
            <img src="/images/devices.svg" alt="A garden sensor connected to SmartGrow" />
            <div><span className="feature-icon">🪴</span><h3>Your devices, together</h3><p>Manage every garden sensor from one cozy corner.</p></div>
          </article>
          <article className="feature-card feature-with-image">
            <img src="/images/readings.svg" alt="A chart showing changing garden sensor readings" />
            <div><span className="feature-icon">📈</span><h3>See what’s changing</h3><p>Explore soil, light, and temperature at a glance.</p></div>
          </article>
          <article className="feature-card feature-with-image">
            <img src="/images/watering.svg" alt="A plant getting a refreshing watering" />
            <div><span className="feature-icon">💧</span><h3>Water in real time</h3><p>Give thirsty plants a drink, wherever you are.</p></div>
          </article>
          <article className="feature-card feature-with-image">
            <img src="/images/sprout.svg" alt="A cheerful new sprout reaching for the sun" />
            <div><span className="feature-icon">🌵</span><h3>Ask Sprout</h3><p>Your plant-loving AI sidekick, ready with a little guidance.</p></div>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div><p className="eyebrow">How it works</p><h2>From sensor to happy plant.</h2><p>Connect your garden, get a clearer picture, and care with confidence.</p></div>
        <div className="diagram-placeholder"><span>🌱</span><strong>Your garden’s journey</strong><p>Sensor → SmartGrow → Your next good decision</p><small>Place your how-it-works diagram here</small></div>
      </section>
      <footer className="site-footer"><span>SmartGrow · A little care goes a long way.</span><Link to="/login">Come on in →</Link></footer>
    </main>
  );
}
