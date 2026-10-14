import {
  confirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
  updateUserAttribute,
} from "aws-amplify/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CURRENT_DEVICE_KEY = "smart-irrigation-selected-device";
const AuthContext = createContext(null);

function profileFromAttributes(attributes, currentUser) {
  return {
    id: currentUser.userId,
    name: attributes.name || "",
    email: attributes.email || currentUser.username || "",
    phone: attributes.phone_number || "",
    emailVerified: attributes.email_verified === "true",
    devices: [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() =>
    localStorage.getItem(CURRENT_DEVICE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    setUser(profileFromAttributes(attributes, currentUser));
  }, []);

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    if (selectedDeviceId) {
      localStorage.setItem(CURRENT_DEVICE_KEY, selectedDeviceId);
    } else {
      localStorage.removeItem(CURRENT_DEVICE_KEY);
    }
  }, [selectedDeviceId]);

  async function register({ name, email, password, phone }) {
    const username = email?.trim().toLowerCase();
    if (!name?.trim() || !username || !password) {
      throw new Error("Name, email, and password are required.");
    }

    const userAttributes = {
      email: username,
      name: name.trim(),
    };
    if (phone?.trim()) userAttributes.phone_number = phone.trim();

    return signUp({ username, password, options: { userAttributes } });
  }

  async function confirmRegistration(email, code) {
    const result = await confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
    return result;
  }

  async function resendConfirmationCode(email) {
    return resendSignUpCode({ username: email.trim().toLowerCase() });
  }

  async function login(email, password) {
    const result = await signIn({ username: email.trim().toLowerCase(), password });
    if (!result.isSignedIn) {
      if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        return { needsConfirmation: true };
      }
      throw new Error(`Sign-in requires an additional step: ${result.nextStep.signInStep}`);
    }
    await refreshUser();
  }

  async function logout() {
    await signOut();
    setUser(null);
    setSelectedDeviceId(null);
  }

  async function updateProfile(nextProfile) {
    if (!user) throw new Error("Please log in before updating your profile.");
    const changes = [
      ["name", nextProfile.name?.trim()],
      ["phone_number", nextProfile.phone?.trim()],
    ];
    for (const [attributeKey, value] of changes) {
      if (value !== undefined && value !== null) {
        await updateUserAttribute({ userAttribute: { attributeKey, value } });
      }
    }
    await refreshUser();
  }

  async function addDevice(deviceId) {
    const trimmedDeviceId = deviceId?.trim();
    if (!trimmedDeviceId) throw new Error("Device ID is required.");
    // Device ownership belongs in the protected backend/DynamoDB profile API.
    // Keep the existing UI usable until that endpoint is connected.
    const devices = Array.from(new Set([...(user?.devices || []), trimmedDeviceId]));
    setUser((current) => ({ ...current, devices }));
    setSelectedDeviceId(trimmedDeviceId);
  }

  async function removeDevice(deviceId) {
    const devices = (user?.devices || []).filter((id) => id !== deviceId);
    setUser((current) => ({ ...current, devices }));
    if (selectedDeviceId === deviceId) setSelectedDeviceId(devices[0] || null);
  }

  const getAccessToken = useCallback(async () => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    return token;
  }, []);

  const value = useMemo(() => ({
    user,
    selectedDeviceId,
    loading,
    login,
    logout,
    register,
    confirmRegistration,
    resendConfirmationCode,
    updateProfile,
    addDevice,
    removeDevice,
    selectDevice: setSelectedDeviceId,
    getAccessToken,
  }), [user, selectedDeviceId, loading, refreshUser, getAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
