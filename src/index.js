
import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { sessionStorage } from "aws-amplify/utils";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./style.css";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_COGNITO_USER_POOL_CLIENT_ID,
    },
  },
});

// Keep Cognito tokens for this tab session only. Closing the tab clears this
// storage, so the next visit requires signing in again.
cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);

// Remove tokens previously saved persistently by Amplify's default localStorage
// provider, scoped to this app's Cognito client.
const cognitoClientId = process.env.REACT_APP_COGNITO_USER_POOL_CLIENT_ID;
if (cognitoClientId && typeof window !== "undefined") {
  const legacyTokenPrefix = `CognitoIdentityServiceProvider.${cognitoClientId}.`;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(legacyTokenPrefix))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
