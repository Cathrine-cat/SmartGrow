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

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const PROFILE_URL = `${API_BASE_URL}/profile`;
const DEVICES_URL = `${API_BASE_URL}/devices`;
const AuthContext = createContext(null);

function profileFromAttributes(attributes, currentUser) {
  return {
    id: currentUser.userId,
    sub: currentUser.userId,
    // Application profile fields come from DynamoDB, never from cached or
    // Cognito profile attributes. Cognito remains the source for identity.
    name: "",
    email: attributes.email || currentUser.username || "",
    phone: "",
    emailVerified: attributes.email_verified === "true",
    devices: [],
  };
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

function mergeDatabaseProfile(baseProfile, responseBody, deviceList) {
  const profile = responseBody?.profile || responseBody?.Item || responseBody || {};
  const nextDevices = deviceList !== undefined
    ? normalizeDeviceList(deviceList)
    : normalizeDeviceList(profile?.deviceIds ?? profile?.devices ?? baseProfile.devices ?? []);

  return {
    ...baseProfile,
    name: profile?.name ?? profile?.Name ?? baseProfile.name,
    phone: profile?.phoneNumber ?? profile?.PhoneNumber ?? profile?.phone ?? profile?.Phone ?? profile?.phone_number ?? baseProfile.phone,
    devices: nextDevices,
  };
}

export function getDisplayName(user) {
  const directName = user?.name ?? user?.Name ?? user?.profile?.name ?? user?.profile?.Name ?? "";
  const trimmedName = typeof directName === "string" ? directName.trim() : "";

  if (trimmedName) {
    return trimmedName;
  }

  const email = user?.email ?? user?.profile?.email ?? "";
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  return trimmedEmail || "User";
}

async function getUserProfile(user, token) {
  if (!user) {
    throw new Error("Please log in first.");
  }

  const userId = user.sub || user.id;
  if (!userId) throw new Error("The signed-in user ID is unavailable.");

  const headers = { Authorization: `Bearer ${token}` };
  const url = new URL(PROFILE_URL);
  url.searchParams.set("userId", userId);

  let response;
  try {
    response = await fetch(url.toString(), { method: "GET", headers });
  } catch {
    throw new Error(`Could not reach GET ${url.toString()}. `);
  }

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
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
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
      // Load the database profile during auth initialization so its name is
      // ready before protected pages render. Device API failures must not
      // discard a successfully loaded profile.
      const [profileResult, devicesResult] = await Promise.allSettled([
        getUserProfile(cognitoProfile, token),
        fetch(DEVICES_URL, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async (response) => {
          if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`Devices read failed with HTTP ${response.status}.`);
          }
          return response.json();
        }),
      ]);

      let profileBody = null;
      if (profileResult.status === "fulfilled") {
        profileBody = profileResult.value;
      } else {
        console.error("Profile read failed:", profileResult.reason);
      }

      let deviceList = [];
      if (devicesResult.status === "fulfilled") {
        const parsedDevices = devicesResult.value;
        deviceList = normalizeDeviceList(parsedDevices?.devices ?? parsedDevices?.items ?? parsedDevices ?? []);
      } else {
        console.error("Devices read failed:", devicesResult.reason);
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
    const [profileResult, devicesResult] = await Promise.allSettled([
      getUserProfile(currentUser, token),
      fetch(DEVICES_URL, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        }),
    ]);

    if (profileResult.status === "rejected") throw profileResult.reason;

    const profileBody = profileResult.value;
    const devicesBody = devicesResult.status === "fulfilled" ? devicesResult.value : undefined;
    if (devicesResult.status === "rejected") {
      console.error("Could not load linked devices:", devicesResult.reason);
    }
    const devices = devicesBody === undefined
      ? undefined
      : normalizeDeviceList(devicesBody?.devices ?? devicesBody?.items ?? devicesBody);
    const mergedProfile = mergeDatabaseProfile(currentUser, profileBody, devices);
    const profileRecord = profileBody?.profile || profileBody?.Item || profileBody;
    const devicesLoaded = devices !== undefined
      || Array.isArray(profileRecord?.devices)
      || Array.isArray(profileRecord?.deviceIds);
    const updatedUser = { ...mergedProfile, devicesLoaded };
    setUser(updatedUser);
    if (devicesLoaded) {
      setSelectedDeviceId((selected) => selected && updatedUser.devices.includes(selected)
        ? selected
        : updatedUser.devices[0] || null);
    }
    return updatedUser;
  }, [getAccessToken]);

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const register = useCallback(async ({ name, email, password, phone }) => {
    const username = email?.trim().toLowerCase();
    if (!name?.trim() || !username || !password) {
      throw new Error("Name, email, and password are required.");
    }

    const userAttributes = { email: username, name: name.trim() };
    if (phone?.trim()) userAttributes.phone_number = phone.trim();
    return signUp({ username, password, options: { userAttributes } });
  }, []);

  const confirmRegistration = useCallback(async (email, code) => {
    return confirmSignUp({
      username: email.trim().toLowerCase(),
      confirmationCode: code.trim(),
    });
  }, []);

  const resendConfirmationCode = useCallback(async (email) => {
    return resendSignUpCode({ username: email.trim().toLowerCase() });
  }, []);

  const login = useCallback(async (email, password) => {
    const username = email?.trim().toLowerCase();
    if (!username || !password) throw new Error("Email and password are required.");

    const result = await signIn({ username, password });
    if (!result.isSignedIn) {
      if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        return { needsConfirmation: true };
      }
      throw new Error(`Sign-in requires an additional step: ${result.nextStep?.signInStep || "verification"}`);
    }

    await refreshUser();
    return result;
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setSelectedDeviceId(null);
  }, []);

  const updateProfile = useCallback(async (profile) => {
    if (!user) throw new Error("Please log in before updating your profile.");

    const nextName = (profile.name ?? user.name ?? "").trim();
    const nextPhone = (profile.phoneNumber ?? profile.phone ?? user.phone ?? "").trim();
    const response = await profileRequest("POST", {
      userId: user.sub || user.id,
      name: nextName,
      phoneNumber: nextPhone,
      PhoneNumber: nextPhone,
      // Accept the common legacy Lambda/table field names while the API is
      // being standardized. The Lambda should persist only its chosen field.
      phone: nextPhone,
      Phone: nextPhone,
    }, PROFILE_URL);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      let errorMessage = responseText;
      try {
        const errorBody = JSON.parse(responseText);
        errorMessage = errorBody.message || errorBody.error || responseText;
      } catch (error) {
        // Keep the raw API Gateway/Lambda response text for useful diagnostics.
      }
      throw new Error(errorMessage || `Profile save failed (HTTP ${response.status}).`);
    }

    await response.json().catch(() => null);

    // A successful POST means the write succeeded. Refresh from DynamoDB when
    // possible, but don't report a failed save just because the follow-up GET
    // endpoint is misconfigured.
    const savedProfile = {
      ...user,
      name: nextName,
      phone: nextPhone,
    };
    setUser(savedProfile);
    try {
      return await refreshProfile();
    } catch (error) {
      console.error("Profile saved, but refreshing it from the database failed:", error);
      return savedProfile;
    }
  }, [user, profileRequest, refreshProfile]);

  const addDevice = useCallback(async (deviceId) => {
    const trimmedDeviceId = deviceId?.trim();
    if (!trimmedDeviceId) throw new Error("Device ID is required.");
    const updatedUser = {
      ...user,
      devices: Array.from(new Set([...(user?.devices || []), trimmedDeviceId])),
    };
    setUser(updatedUser);
    setSelectedDeviceId(trimmedDeviceId);
    return updatedUser;
  }, [user]);

  const removeDevice = useCallback(async (deviceId) => {
    const devices = (user?.devices || []).filter((id) => id !== deviceId);
    const updatedUser = { ...user, devices };
    setUser(updatedUser);
    if (selectedDeviceId === deviceId) setSelectedDeviceId(devices[0] || null);
    return updatedUser;
  }, [user, selectedDeviceId]);

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
  }), [
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
    getAccessToken,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
