
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "react-oidc-context";

export default function ProtectedRoute() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <p>Checking your login...</p>;
  }

  if (auth.error) {
    return <p>Authentication error: {auth.error.message}</p>;
  }

  return auth.isAuthenticated
    ? <Outlet />
    : <Navigate to="/login" replace />;
}
