
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function ProtectedLayout() {
  const auth = useAuth();

  async function handleSignOut() {
    try {
      if (auth?.removeUser) {
        await auth.removeUser();
      }
    } catch (error) {
      console.warn("Sign-out cleanup warning:", error);
    }

    window.location.assign(window.location.origin + "/");
  }

  const menuItems = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/reports", label: "Reports" },
    { to: "/alerts", label: "Alerts" },
    { to: "/settings", label: "Settings" },
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
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                isActive ? "menu-link active" : "menu-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="user-panel">
          <span className="user-email">{auth.user?.profile?.email || "User"}</span>
          <button type="button" className="signout-button" onClick={handleSignOut}>
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
