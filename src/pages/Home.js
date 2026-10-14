
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function Home() {
  const auth = useAuth();

  return (
    <main className="home-page">
      <header className="site-header">
        <div className="site-brand">
          <span className="brand-mark">S</span>
          <span>SmartGrow</span>
        </div>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#benefits">Benefits</a>
          <a href="#about">About</a>
          {auth.isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary">Dashboard</Link>
          ) : (
            <Link to="/login" className="btn btn-primary">Login</Link>
          )}
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Smarter agriculture</p>
          <h1>Grow healthier crops with intelligent irrigation.</h1>
          <p className="hero-text">
            Monitor soil moisture, automate watering, and track environmental trends in real time.
            Keep your fields productive with fewer manual checks and better water efficiency.
          </p>

          <div className="cta-row">
            {auth.isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
            ) : (
              <Link to="/login" className="btn btn-primary">Login</Link>
            )}
            <a href="#features" className="btn btn-secondary">Explore features</a>
          </div>

          <div className="hero-stats">
            <div>
              <strong>24/7</strong>
              <span>Monitoring</span>
            </div>
            <div>
              <strong>32%</strong>
              <span>Water savings</span>
            </div>
            <div>
              <strong>1.2k</strong>
              <span>Readings tracked</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <img
            src="https://images.unsplash.com/photo-1464226184884-fa52ac9c0d86?auto=format&fit=crop&w=900&q=80"
            alt="Irrigated field"
          />
        </div>
      </section>

      <section id="features" className="feature-section">
        <div className="section-heading">
          <p className="eyebrow">Features</p>
          <h2>Everything you need for efficient irrigation</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <h3>Live sensor data</h3>
            <p>Monitor moisture, light, temperature, and pump performance in real time.</p>
          </article>
          <article className="feature-card">
            <h3>Smart automation</h3>
            <p>Reduce waste with automatic watering based on soil thresholds and schedules.</p>
          </article>
          <article className="feature-card">
            <h3>Historical insights</h3>
            <p>Review trends, identify patterns, and make better irrigation decisions.</p>
          </article>
        </div>
      </section>

      <section id="benefits" className="benefits-section">
        <div className="benefit-copy">
          <p className="eyebrow">Why choose us</p>
          <h2>Healthy plants, lower costs, less waste.</h2>
        </div>

        <div className="benefit-list">
          <div>
            <strong>Fewer manual checks</strong>
            <p>Automated monitoring keeps your system in sync without constant intervention.</p>
          </div>
          <div>
            <strong>Better crop health</strong>
            <p>Balanced watering supports stronger roots and more consistent growth.</p>
          </div>
          <div>
            <strong>Lower water usage</strong>
            <p>Water only when conditions require it, helping you save resources and budget.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
