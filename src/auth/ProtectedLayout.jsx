
import { NavLink, Outlet } from "react-router-dom";
import { getDisplayName, useAuth } from "./AuthContext";
import useUnreadNotifications from "../hooks/useUnreadNotifications";

export default function ProtectedLayout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useUnreadNotifications();

  const menuItems = [
    { to: "/app", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/devices", label: "Devices" },
    { to: "/profile", label: "Profile" },
    { to: "/journal", label: "Plant journal" },
    { to: "/notifications", label: "Notifications" },
    { to: "/assistant", label: "🌵 Sprout" },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <img className="brand-mark plant-logo" src="/images/plant.png" alt="" aria-hidden="true" />
          <span>SmartGrow</span>
        </div>

        <nav className="app-menu" aria-label="Main navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app" || item.to === "/dashboard"}
              className={({ isActive }) =>
                isActive ? "menu-link active" : "menu-link"
              }
            >
              <span>{item.label}</span>
              {item.to === "/notifications" && unreadCount > 0 && (
                <span
                  className="nav-notification-dot"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="user-panel">
          <span className="user-email">{getDisplayName(user)}</span>
          <button type="button" className="signout-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
