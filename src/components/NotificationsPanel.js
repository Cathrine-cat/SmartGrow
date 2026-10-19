const deviceIdOf = (device) => typeof device === "string" ? device : device?.deviceId || device?.id || "";
const deviceNameOf = (device) => typeof device === "string" ? "Unnamed device" : device?.name || device?.Name || "Unnamed device";
const notificationDeviceIdOf = (notification) => notification?.deviceId || notification?.device_id || notification?.id || "";

function notificationDeviceName(notification, devices) {
  const deviceId = notificationDeviceIdOf(notification);
  const device = devices.find((item) => deviceIdOf(item) === deviceId);
  return device ? deviceNameOf(device) : notification?.deviceName || notification?.device_name || deviceId || "Unknown device";
}

export default function NotificationsPanel({ notifications, unreadCount, devices = [], onMarkRead }) {
  return (
    <section className="info-panel notification-panel">
      <div className="notification-heading">
        <div>
          <p className="eyebrow">Sensor notifications</p>
          <h2>Things to check</h2>
        </div>
        {unreadCount > 0 && <span className="notification-count">{unreadCount} new</span>}
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
                  {notificationDeviceName(item, devices)} · {item.createdAt
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

                {!item.read && onMarkRead && (
                  <button type="button" onClick={() => onMarkRead(item)}>
                    Mark as read
                  </button>
                )}
              </div>

              {!item.read && <span className="notification-unread-dot" aria-label="Unread" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
