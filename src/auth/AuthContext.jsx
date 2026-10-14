import {
  confirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const CURRENT_DEVICE_KEY = "smart-irrigation-selected-device";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const PROFILE_URL = `${API_BASE_URL}/profile`;
const DEVICES_URL = `${API_BASE_URL}/devices`;
const LOCAL_USERS_KEY = "smart-irrigation-users";
const CURRENT_USER_KEY = "smart-irrigation-current-user";
const AuthContext = createContext(null);

function readLocalUsers() {
  try {
    const stored = localStorage.getItem(LOCAL_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function saveCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function readCurrentUser() {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function profileFromAttributes(attributes, currentUser) {
  return {
    id: currentUser.userId,
    sub: currentUser.userId,
    name: attributes.name || "",
    email: attributes.email || currentUser.username || "",
    phone: attributes.phone_number || "",
    emailVerified: attributes.email_verified === "true",
    devices: [],
  };
}

function readSelectedDevice() {
  const stored = localStorage.getItem(CURRENT_DEVICE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return typeof parsed === "string" ? parsed : stored;
  } catch (error) {
    return stored;
  }
}

function normalizeDeviceList(devices) {
  if (!devices) return [];

  const list = Array.isArray(devices) ? devices : [devices];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "number") return String(item);
      return item?.deviceId || item?.id || item?.device || item?.number || item?.deviceNumber || item?.serialNumber || "";
    })
    .filter(Boolean);
}

function mergeDatabaseProfile(baseProfile, responseBody, deviceList = []) {
  const profile = responseBody?.profile || responseBody || {};
  const nextDevices = normalizeDeviceList(
    deviceList?.length ? deviceList : profile?.deviceIds ?? profile?.devices ?? []
  );

  return {
    ...baseProfile,
    name: profile?.name ?? baseProfile.name,
    phone: profile?.phoneNumber ?? profile?.phone ?? baseProfile.phone,
    devices: nextDevices.length ? nextDevices : baseProfile.devices || [],
  };
}



async function getUserProfile(user, token) {
  if (!user) {
    throw new Error("Please log in first.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(PROFILE_URL, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || errorBody?.error || `Failed to fetch profile (${response.status}).`);
  }

  return await response.json();
}


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [selectedDeviceId, setSelectedDeviceId] = useState(readSelectedDevice);
  const [loading, setLoading] = useState(true);

  const getAccessToken = useCallback(async () => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    return token;
  }, []);

  const profileRequest = useCallback(async (method, body, url = PROFILE_URL) => {
    const token = await getAccessToken();
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    const options = { method, headers };
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(body);
    }
    return fetch(url, options);
  }, [getAccessToken]);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    const cognitoProfile = profileFromAttributes(attributes, currentUser);

    try {
      const token = await getAccessToken();
      const [profileBody, devicesResponse] = await Promise.all([
        getUserProfile(cognitoProfile, token).catch((error) => {
          console.error("Profile read failed:", error);
          return null;
        }),
        fetch(DEVICES_URL, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let deviceList = [];

      if (devicesResponse.ok) {
        const parsedDevices = await devicesResponse.json();
        deviceList = normalizeDeviceList(parsedDevices?.devices ?? parsedDevices?.items ?? parsedDevices ?? []);
      } else if (devicesResponse.status !== 404) {
        console.error(`Devices read failed with HTTP ${devicesResponse.status}.`);
      }

      const mergedProfile = mergeDatabaseProfile(cognitoProfile, profileBody, deviceList);
      setUser(mergedProfile);
      return mergedProfile;
    } catch (error) {
      console.error("Could not load the DynamoDB profile or devices:", error);
    }

    setUser(cognitoProfile);
    return cognitoProfile;
  }, [getAccessToken]);

  // Fetch the editable profile and device links from the API on demand.
  // Keep this callback stable so Profile's mount effect doesn't fetch forever
  // every time setUser publishes the refreshed data.
  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) throw new Error("Please log in before loading your profile.");

    const token = await getAccessToken();
    const [profileBody, devicesResponse] = await Promise.all([
      getUserProfile(currentUser, token),
      fetch(DEVICES_URL, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!devicesResponse.ok) {
      throw new Error(`Could not load linked devices (HTTP ${devicesResponse.status}).`);
    }

    const devicesBody = await devicesResponse.json();
    const devices = normalizeDeviceList(devicesBody?.devices ?? devicesBody?.items ?? devicesBody);
    const updatedUser = mergeDatabaseProfile(currentUser, profileBody, devices);
    setUser(updatedUser);
    setSelectedDeviceId((selected) => selected && devices.includes(selected)
      ? selected
      : devices[0] || null);
    return updatedUser;
  }, [getAccessToken]);

  useEffect(() => {
    const storedUser = readCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }

    refreshUser()
      .catch(() => setUser(readCurrentUser()))
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

    try {
      const userAttributes = { email: username, name: name.trim() };
      if (phone?.trim()) userAttributes.phone_number = phone.trim();
      return await signUp({ username, password, options: { userAttributes } });
    } catch (error) {
      // Fall back to a local-only store when Amplify is not configured in this environment.
    }

    const users = readLocalUsers();
    const existing = users.some((storedUser) => storedUser.email?.toLowerCase() === username);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const nextUser = {
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sub: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      email: username,
      password,
      phone: phone?.trim() || "",
      devices: [],
    };

    const nextUsers = [...users, nextUser];
    writeLocalUsers(nextUsers);
    setUser(nextUser);
    saveCurrentUser(nextUser);
    return { user: nextUser, isSignedIn: true };
  }

  async function confirmRegistration(email, code) {
    return confirmSignUp({
      username: email.trim().toLowerCase(),
      confirmationCode: code.trim(),
    });
  }

  async function resendConfirmationCode(email) {
    return resendSignUpCode({ username: email.trim().toLowerCase() });
  }

  async function login(email, password) {
    const username = email?.trim().toLowerCase();
    if (!username || !password) throw new Error("Email and password are required.");

    try {
      const result = await signIn({ username, password });
      if (!result.isSignedIn) {
        if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          return { needsConfirmation: true };
        }
        throw new Error(`Sign-in requires an additional step: ${result.nextStep?.signInStep || "verification"}`);
      }

      await refreshUser();
      return result;
    } catch (error) {
      const users = readLocalUsers();
      const match = users.find((storedUser) => storedUser.email?.toLowerCase() === username);

      if (!match || match.password !== password) {
        throw new Error("Invalid email or password.");
      }

      setUser(match);
      saveCurrentUser(match);
      return { isSignedIn: true, user: match };
    }
  }

  async function logout() {
    try {
      await signOut();
    } catch (error) {
      // Local-only sessions do not require an Amplify sign-out.
    }

    setUser(null);
    saveCurrentUser(null);
    setSelectedDeviceId(null);
  }

  async function updateProfile(profile) {
    if (!user) throw new Error("Please log in before updating your profile.");

    const nextName = (profile.name ?? user.name ?? "").trim();
    const nextPhone = (profile.phoneNumber ?? profile.phone ?? user.phone ?? "").trim();
    const response = await profileRequest("POST", {
      userId: user.sub || user.id,
      name: nextName,
      phoneNumber: nextPhone,
    }, PROFILE_URL);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || `Profile save failed (HTTP ${response.status}).`);
    }

    await response.json().catch(() => null);
    // The GET response is the source of truth after the write.
    return refreshProfile();
  }

  async function addDevice(deviceId) {
    const trimmedDeviceId = deviceId?.trim();
    if (!trimmedDeviceId) throw new Error("Device ID is required.");
    const updatedUser = {
      ...user,
      devices: Array.from(new Set([...(user?.devices || []), trimmedDeviceId])),
    };
    setUser(updatedUser);
    setSelectedDeviceId(trimmedDeviceId);
    return updatedUser;
  }

  async function removeDevice(deviceId) {
    const devices = (user?.devices || []).filter((id) => id !== deviceId);
    const updatedUser = { ...user, devices };
    setUser(updatedUser);
    if (selectedDeviceId === deviceId) setSelectedDeviceId(devices[0] || null);
    return updatedUser;
  }

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
    refreshProfile,
    addDevice,
    removeDevice,
    selectDevice: setSelectedDeviceId,
    getAccessToken,
  }), [user, selectedDeviceId, loading, getAccessToken, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
