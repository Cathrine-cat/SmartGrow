
import { NavLink, Outlet } from "react-router-dom";
import { getDisplayName, useAuth } from "./AuthContext";

export default function ProtectedLayout() {
  const { user, logout } = useAuth();

  const menuItems = [
    { to: "/app", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/devices", label: "Devices" },
    { to: "/profile", label: "Profile" },
    { to: "/alerts", label: "Alerts" },
    { to: "/assistant", label: "Plant assistant" },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark">S</span>
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
              {item.label}
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
