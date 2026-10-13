
import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "react-oidc-context";

import App from "./App";
import "./style.css";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_lg2c9gK3O",
  client_id: "5e1sld4og5nol6jebrcgrqt7tn",
  redirect_uri: "http://localhost:3000/",
  response_type: "code",
  scope: "phone openid email",
};

const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
