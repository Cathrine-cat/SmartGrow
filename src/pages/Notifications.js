import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import NotificationsPanel from "../components/NotificationsPanel";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const deviceIdOf = (device) => typeof device === "string" ? device : device?.deviceId || device?.id || "";

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  return body;
}

function unreadNotifications(body) {
  const rows = Array.isArray(body.notifications) ? body.notifications : [];
  return rows.filter((item) => item.read !== true && item.read !== "true");
}

export default function Notifications() {
  const { getAccessToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    const [notificationResponse, deviceResponse] = await Promise.all([
      authorizedFetch(`${API_BASE_URL}/notifications`).then(readJson),
      authorizedFetch(`${API_BASE_URL}/devices`).then(readJson),
    ]);
    const unread = unreadNotifications(notificationResponse);
    setNotifications(unread);
    setUnreadCount(Array.isArray(notificationResponse.notifications)
      ? unread.length
      : Number(notificationResponse.unreadCount) || 0);
    setDevices(Array.isArray(deviceResponse.devices) ? deviceResponse.devices : []);
    setError("");
  }, [authorizedFetch]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load notifications.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refresh]);

  async function markRead(notification) {
    try {
      await readJson(await authorizedFetch(
        `${API_BASE_URL}/notifications/${encodeURIComponent(notification.notificationId)}/read`,
        { method: "PATCH" }
      ));
      await refresh();
    } catch (markError) {
      setError(markError.message || "Unable to mark this notification as read.");
    }
  }

  return (
    <section className="content-page notifications-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Across your garden</p>
          <h1>Notifications</h1>
          <p className="journal-intro">Updates from all of your connected devices.</p>
        </div>
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}
      {loading ? (
        <div className="info-panel"><p>Loading notifications…</p></div>
      ) : (
        <NotificationsPanel
          notifications={notifications}
          unreadCount={unreadCount}
          devices={devices}
          onMarkRead={markRead}
        />
      )}
    </section>
  );
}
