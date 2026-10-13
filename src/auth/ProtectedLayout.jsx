
import { Outlet } from "react-router-dom";
import { useAuth } from "react-oidc-context";

const CLIENT_ID = "5e1sld4og5nol6jebrcgrqt7tn";

// Replace this with your actual Cognito domain.
const COGNITO_DOMAIN =
  "https://eu-north-1_lg2c9gK3O.auth.eu-north-1.amazoncognito.com";

export default function ProtectedLayout() {
  const auth = useAuth();

  async function handleSignOut() {
    await auth.removeUser();

    const logoutUrl = new URL(
      `${COGNITO_DOMAIN}/logout`
    );

    logoutUrl.searchParams.set("client_id", CLIENT_ID);
    logoutUrl.searchParams.set(
      "logout_uri",
      window.location.origin + "/"
    );

    window.location.assign(logoutUrl.toString());
  }

  return (
    <>
      <header>
        <a href="/">SmartGrow</a>

        <span>
          {auth.user?.profile.email}
        </span>

        <button onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <Outlet />
    </>
  );
}
