import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const EMPTY_RULES = { soilMin: "", soilMax: "", temperatureMin: "", temperatureMax: "" };
const deviceIdOf = (device) => typeof device === "string" ? device : device?.deviceId || device?.id || "";
const deviceNameOf = (device) => typeof device === "string" ? "Unnamed device" : device?.name || device?.Name || "Unnamed device";
const timeOf = (event) => event.timestamp || event.time || event.createdAt || event.date;
const rowDeviceId = (item) => item?.deviceId || item?.device_id || item?.id || item?.settingId;

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  return body;
}

export default function PlantJournal() {
  const { selectedDeviceId, selectDevice, getAccessToken } = useAuth();
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState(null);
  const [events, setEvents] = useState([]);
  const [rules, setRules] = useState(EMPTY_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  const loadNotifications = useCallback(async () => {
    const body = await readJson(
      await authorizedFetch(`${API_BASE_URL}/notifications`)
    );
    setNotifications(Array.isArray(body.notifications) ? body.notifications : []);
    setUnreadCount(Number(body.unreadCount) || 0);
  }, [authorizedFetch]);

  useEffect(() => {
    let active = true;
    authorizedFetch(`${API_BASE_URL}/devices`).then(readJson).then((body) => {
      if (!active) return;
      const list = Array.isArray(body.devices) ? body.devices : [];
      setDevices(list);
      const ids = list.map(deviceIdOf);
      selectDevice((current) => ids.includes(current) ? current : ids[0] || null);
    }).catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authorizedFetch, selectDevice]);


  useEffect(() => {
  let active = true;

  const refresh = async () => {
    try {
      const body = await readJson(
        await authorizedFetch(`${API_BASE_URL}/notifications`)
      );

      if (!active) return;

      setNotifications(
        Array.isArray(body.notifications) ? body.notifications : []
      );
      setUnreadCount(Number(body.unreadCount) || 0);
    } catch (error) {
      if (active) {
        console.error("Unable to load notifications:", error);
      }
    }
  };

  refresh();

  const interval = setInterval(refresh, 15000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}, [authorizedFetch]);

  useEffect(() => {
    if (!selectedDeviceId) { setReadings(null); setEvents([]); setRules(EMPTY_RULES); return undefined; }
    let active = true;
    const endpoint = (path) => { const url = new URL(`${API_BASE_URL}/${path}`); url.searchParams.set("deviceId", selectedDeviceId); return url.toString(); };
    setError("");
    setReadings(null);
    setEvents([]);
    setRules(EMPTY_RULES);

    const refreshReadings = () => authorizedFetch(endpoint("latest-data")).then(readJson).then((reading) => {
      if (active) setReadings(rowDeviceId(reading) === selectedDeviceId ? reading : null);
    }).catch((loadError) => { if (active) setError(loadError.message); });

    Promise.allSettled([
      refreshReadings(),
      authorizedFetch(endpoint("watering-history")).then(readJson),
      authorizedFetch(endpoint("notification-conditions")).then(readJson),
    ]).then(([, history, conditionResponse]) => {
      if (!active) return;
      if (history.status === "fulfilled") {
        const rows = Array.isArray(history.value) ? history.value : history.value.items || history.value.history || history.value.records || [];
        const list = rows.filter((item) => rowDeviceId(item) === selectedDeviceId);
        setEvents(list.slice().sort((a, b) => new Date(timeOf(b) || 0) - new Date(timeOf(a) || 0)));
      }
      if (conditionResponse.status === "fulfilled") setRules({ ...EMPTY_RULES, ...(conditionResponse.value.conditions || {}) });
      else setError(conditionResponse.reason?.message || "Could not load alert conditions.");
    });
    const readingInterval = setInterval(refreshReadings, 10000);

    return () => { active = false; clearInterval(readingInterval); };
  }, [authorizedFetch, selectedDeviceId]);

  async function saveJournal(event) {
    event.preventDefault();
    if (!selectedDeviceId) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await readJson(await authorizedFetch(`${API_BASE_URL}/notification-conditions?deviceId=${encodeURIComponent(selectedDeviceId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      }));
      setMessage("Alert conditions saved for this device.");
    } catch (saveError) {
      setError(saveError.message);
    } finally { setSaving(false); }
  }

  const selectedDevice = devices.find((device) => deviceIdOf(device) === selectedDeviceId);
  const currentAlerts = [
    ["Soil moisture", readings?.soil, rules.soilMin, rules.soilMax, "%"],
    ["Temperature", readings?.temperature, rules.temperatureMin, rules.temperatureMax, "°C"],
  ].flatMap(([label, value, min, max, unit]) => {
    if (value == null) return [];
    const numeric = Number(value);
    if (min !== "" && numeric < Number(min)) return [`${label} is below your ${min}${unit} minimum (${numeric}${unit}).`];
    if (max !== "" && numeric > Number(max)) return [`${label} is above your ${max}${unit} maximum (${numeric}${unit}).`];
    return [];
  });

  return <section className="content-page journal-page">
    <div className="page-header"><div><p className="eyebrow">Your garden’s memory</p><h1>Plant journal</h1><p className="journal-intro">A device-by-device record of watering, changing conditions, and the things you want to watch.</p></div>
      {devices.length > 0 && <label className="dashboard-device-select"><span>Choose a device</span><select value={selectedDeviceId || ""} onChange={(event) => selectDevice(event.target.value)}>{devices.map((device) => <option key={deviceIdOf(device)} value={deviceIdOf(device)}>{deviceNameOf(device)}</option>)}</select></label>}
    </div>
    {error && <p className="error-box" role="alert">{error}</p>}{message && <p className="success-text" role="status">{message}</p>}
    {loading ? <div className="info-panel"><p>Loading your garden journal…</p></div> : !devices.length ? <div className="info-panel"><h2>Start your garden story</h2><p>Link a sensor to see readings, watering activity, and set the conditions you want to keep an eye on.</p><Link to="/devices" className="btn btn-primary">Add a device</Link></div> : <>
      <div className="journal-summary">
        <div>
          <span>Selected device</span>
          <strong>{selectedDevice ? deviceNameOf(selectedDevice) : "Your garden"}</strong>
        </div>
        <div>
          <span>Latest soil moisture</span>
          <strong>{readings?.soil ?? "—"}{readings?.soil != null ? "%" : ""}</strong>
          </div>
          <div>
            <span>Watering events</span>
            <strong>{events.length}</strong>
            </div>
          </div>

      


<section className="info-panel notification-panel">
  <div className="notification-heading">
    <div>
      <p className="eyebrow">Sensor notifications</p>
      <h2>Things to check</h2>
    </div>

    {unreadCount > 0 && (
      <span className="notification-count">
        {unreadCount} new
      </span>
    )}
  </div>

  {notifications.length === 0 ? (
    <p>No notifications yet. We'll let you know when a configured condition is met.</p>
  ) : (
    <ul className="notification-list">
      {notifications.map((item) => (
        <li
          key={item.notificationId}
          className={item.read ? "notification-item" : "notification-item unread"}
        >
          <div className="notification-icon" aria-hidden="true">
            {item.type?.includes("TEMPERATURE") ? "🌡️" : "💧"}
          </div>

          <div className="notification-content">
            <strong>{item.message}</strong>
            <p>
              {item.deviceId} ·{" "}
              {item.createdAt
                ? new Date(item.createdAt).toLocaleString()
                : "Time unavailable"}
            </p>
            <small>
              Recorded value: {item.value}
              {item.type?.includes("TEMPERATURE") ? "°C" : "%"}
              {" · Threshold: "}
              {item.threshold}
              {item.type?.includes("TEMPERATURE") ? "°C" : "%"}
            </small>

            {!item.read && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await readJson(
                      await authorizedFetch(
                        `${API_BASE_URL}/notifications/${encodeURIComponent(item.notificationId)}/read`,
                        { method: "PATCH" }
                      )
                    );
                    await loadNotifications();
                  } catch (error) {
                    setError(error.message);
                  }
                }}
              >
                Mark as read
              </button>
            )}
          </div>

          {!item.read && (
            <span className="notification-unread-dot" aria-label="Unread" />
          )}
        </li>
      ))}
    </ul>
  )}
</section>


      <div className="journal-columns">
        <section className="info-panel journal-timeline">
          <p className="eyebrow">Recent activity</p>
          <h2>Watering history</h2>
        {events.length ? 
        <ol className="timeline">{events.slice(0, 12).map((item, index) => 
          <li key={`${timeOf(item) || index}-${index}`}>
            <span className="timeline-dot">💧</span>
            <div>
              <strong>{item.event || item.action || item.source || "Watering event"}</strong>
              <p>{timeOf(item) ? new Date(timeOf(item)).toLocaleString() : "Time not recorded"}{item.duration ? ` · ${item.duration}s` : ""}</p>
            </div>
          </li>)}
        </ol> : 
        <p>No watering events recorded for this device yet.</p>}
        <div className="journal-reading-note"><strong>Latest sensor check</strong><p>Soil {readings?.soil ?? "—"}% · {readings?.temperature ?? "—"}°C · Humidity {readings?.humidity ?? "—"}%</p><small>{readings?.timestamp ? new Date(readings.timestamp).toLocaleString() : "No timestamp available"}</small></div>
      </section>
      <section className="info-panel journal-settings">
        <p className="eyebrow">A gentle nudge</p>
        <h2>What should we watch for?</h2>
        <p>Set device-specific limits for soil moisture and temperature. Readings refresh every 10 seconds while this page is open.</p>
        {currentAlerts.length > 0 && 
        <div className="journal-alerts" role="status">{currentAlerts.map((alert) => <p key={alert}>🔔 {alert}</p>)}</div>}
        <form onSubmit={saveJournal} className="journal-form">
          <fieldset>
            <legend>Soil moisture (%)</legend>
              <label>Below <input type="number" min="0" max="100" value={rules.soilMin} onChange={(e) => setRules((current) => ({ ...current, soilMin: e.target.value }))} placeholder="No minimum" /></label>
              <label>Above <input type="number" min="0" max="100" value={rules.soilMax} onChange={(e) => setRules((current) => ({ ...current, soilMax: e.target.value }))} placeholder="No maximum" /></label>
          </fieldset>
          <fieldset>
            <legend>Temperature (°C)</legend>
              <label>Below <input type="number" value={rules.temperatureMin} onChange={(e) => setRules((current) => ({ ...current, temperatureMin: e.target.value }))} placeholder="No minimum" /></label>
              <label>Above <input type="number" value={rules.temperatureMax} onChange={(e) => setRules((current) => ({ ...current, temperatureMax: e.target.value }))} placeholder="No maximum" /></label>
          </fieldset>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save for this device"}</button>
        </form>
      </section></div>
    </>}
  </section>;
}
