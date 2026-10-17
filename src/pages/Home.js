import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getDisplayName, useAuth } from "../auth/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const deviceIdOf = (device) => typeof device === "string" ? device : device?.deviceId || device?.id || "";
const rowDeviceId = (item) => item?.deviceId || item?.device_id || item?.id || item?.settingId;
const deviceNameOf = (device) => typeof device === "string" ? "Unnamed device" : device?.name || device?.Name || "Unnamed device";

export default function Home() {
  const { user, loading, selectedDeviceId, selectDevice, getAccessToken } = useAuth();
  const { pathname } = useLocation();
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState(null);
  const [watering, setWatering] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    return fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  }, [getAccessToken]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    authorizedFetch(`${API_BASE_URL}/devices`).then((response) => response.json())
      .then((body) => {
        if (!active) return;
        const records = Array.isArray(body.devices) ? body.devices : [];
        setDevices(records);
        const ids = records.map(deviceIdOf).filter(Boolean);
        selectDevice((current) => ids.includes(current) ? current : ids[0] || null);
      }).catch(() => { if (active) setDevices([]); });
    return () => { active = false; };
  }, [authorizedFetch, selectDevice, user]);

  useEffect(() => {
    if (!selectedDeviceId) { setReadings(null); setWatering([]); return undefined; }
    let active = true;
    setDataLoading(true);
    const urlFor = (path) => {
      const url = new URL(`${API_BASE_URL}/${path}`);
      url.searchParams.set("deviceId", selectedDeviceId);
      return url.toString();
    };
    Promise.all([
      authorizedFetch(urlFor("latest-data")).then((response) => response.json()),
      authorizedFetch(urlFor("watering-history")).then((response) => response.json()),
    ]).then(([latest, history]) => {
      if (!active) return;
      setReadings(rowDeviceId(latest) === selectedDeviceId ? latest : null);
      const rows = Array.isArray(history) ? history : history.items || history.history || [];
      setWatering(rows.filter((item) => rowDeviceId(item) === selectedDeviceId));
    }).catch(() => { if (active) { setReadings(null); setWatering([]); } })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; };
  }, [authorizedFetch, selectedDeviceId]);

  if (loading) return <p className="home-loading">Checking your login…</p>;
  if (user && pathname === "/") return <Navigate to="/app" replace />;

  if (user) {
    const displayName = getDisplayName(user);
    const device = devices.find((item) => deviceIdOf(item) === selectedDeviceId);
    const latestWatering = watering.slice().sort((a, b) => new Date(b.timestamp || b.time || 0) - new Date(a.timestamp || a.time || 0))[0];
    const readingTime = readings?.timestamp ? new Date(readings.timestamp).toLocaleString() : "No reading yet";
    return (
      <section className="content-page personal-home">
        <div className="welcome-banner">
          <div><p className="eyebrow">Your garden, at a glance</p><h1>Good to see you, {displayName}.</h1>
            <p>{device ? `Here’s the latest from ${deviceNameOf(device)}.` : "Link a sensor to see what your garden needs today."}</p></div>
          <span className="welcome-plant" aria-hidden="true">🌿</span>
        </div>
        {devices.length > 0 && <label className="dashboard-device-select home-device-select"><span>Garden device</span>
          <select value={selectedDeviceId || ""} onChange={(event) => selectDevice(event.target.value)}>{devices.map((item) => <option key={deviceIdOf(item)} value={deviceIdOf(item)}>{deviceNameOf(item)}</option>)}</select>
        </label>}
        <div className="stats-grid home-reading-grid">
          <div className="stat-card"><span>Soil moisture</span><strong>{readings?.soil ?? "—"}{readings?.soil != null ? "%" : ""}</strong><small>{readings ? readingTime : dataLoading ? "Checking sensor…" : "Waiting for sensor data"}</small></div>
          <div className="stat-card"><span>Air temperature</span><strong>{readings?.temperature ?? "—"}{readings?.temperature != null ? "°C" : ""}</strong><small>Latest sensor reading</small></div>
          <div className="stat-card"><span>Air humidity</span><strong>{readings?.humidity ?? "—"}{readings?.humidity != null ? "%" : ""}</strong><small>Latest sensor reading</small></div>
        </div>
        <div className="home-content-grid">
          <article className="journal-highlight"><div><p className="eyebrow">Recent activity</p><h2>{latestWatering ? "Last watering" : "Your garden journal"}</h2>
            {latestWatering ? <p>{new Date(latestWatering.timestamp || latestWatering.time).toLocaleString()} · {latestWatering.duration ? `${latestWatering.duration}s` : "Watering recorded"}</p> : <p>{devices.length ? "No watering event is recorded yet. Your activity will show here as it happens." : "Add a device to begin recording sensor readings and watering activity."}</p>}
            <Link to="/journal" className="text-link">Open plant journal →</Link></div>
            <img src="/images/plants_main_page.jpg" alt="Sunlight falling on a thriving green garden" />
          </article>
          <article className="garden-tip"><span className="tip-icon" aria-hidden="true">☀️</span><div><p className="eyebrow">Garden note</p><h2>{readings?.soil != null && Number(readings.soil) < 30 ? "Your soil may be getting dry" : "A little context goes a long way"}</h2><p>{readings?.soil != null && Number(readings.soil) < 30 ? `Soil moisture is ${readings.soil}%. Check the plant and your moisture target before watering.` : "Use sensor readings alongside your plant’s needs. Pot size, sunlight, and growth stage all affect when it’s time to water."}</p></div></article>
        </div>
        <div className="home-quick-links"><Link to="/dashboard">View live dashboard</Link><Link to="/devices">Manage devices</Link><Link to="/assistant">Meet Sprout 🌵</Link></div>
      </section>
    );
  }

  return (
    <main className="home-page">
      <header className="site-header"><Link to="/" className="site-brand"><img className="brand-mark plant-logo" src="/images/plant.png" alt="" aria-hidden="true" /><span>SmartGrow</span></Link>
        <nav className="site-nav" aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><Link to="/login" className="btn btn-secondary">Sign in</Link></nav>
      </header>
      <section className="hero-section">
        <div className="hero-copy"><p className="eyebrow">A little more in tune with nature</p><h1>Know what your garden needs.</h1>
          <p className="hero-text">Monitor soil moisture and environmental conditions, manage irrigation remotely, and understand your garden's history from one place.</p>
          <div className="cta-row"><Link to="/login?mode=register" className="btn btn-primary">Get started</Link><Link to="/login" className="btn btn-secondary">Sign in</Link></div>
          <p className="hero-footnote">Less guesswork. Happier plants. 🌱</p>
        </div>
        <div className="hero-visual"><img src="/images/plants_main_page.jpg" alt="A lush home garden growing in warm sunlight" /></div>
      </section>
      <section id="features" className="feature-section"><div className="section-heading"><p className="eyebrow">Made for your growing space</p><h2>Everything your garden needs. All in one place.</h2><p>Small, useful details that make plant care feel effortless.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-with-image"><img src="/images/devices_image.png" alt="A garden sensor connected to SmartGrow" /><div><span className="feature-icon">🪴</span><h3>Your devices, together</h3><p>Manage every garden sensor from one cozy corner.</p></div></article>
          <article className="feature-card feature-with-image"><img src="/images/graphs.png" alt="A chart showing changing garden sensor readings" /><div><span className="feature-icon">📈</span><h3>See what’s changing</h3><p>Explore soil, light, and temperature at a glance.</p></div></article>
          <article className="feature-card feature-with-image"><img src="/images/watering.jpg" alt="A plant getting a refreshing watering" /><div><span className="feature-icon">💧</span><h3>Water in real time</h3><p>Give thirsty plants a drink, wherever you are.</p></div></article>
          <article className="feature-card feature-with-image"><img src="/images/cactus.jpg" alt="A cheerful new sprout reaching for the sun" /><div><span className="feature-icon">🌵</span><h3>Ask Sprout</h3><p>Your plant-loving AI sidekick, ready with a little guidance.</p></div></article>
        </div>
      </section>
      <section id="how-it-works" className="how-section">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>From sensor to happy plant.</h2>
          <p>Connect your garden, get a clearer picture, and care with confidence.</p>
        </div>
        <div className="diagram-placeholder">
          <img src="/images/how_it_works.png" alt="Your garden’s journey: Sensor → Device → Data proccessed → SmartGrow → Actions" />
        </div>
      </section>
      <footer className="site-footer"><span>SmartGrow · A little care goes a long way.</span><Link to="/login">Come on in →</Link></footer>
    </main>
  );
}
