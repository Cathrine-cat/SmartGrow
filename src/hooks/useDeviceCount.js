
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const BASE_URL =
  "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";

export default function useDeviceCount() {
  const { user, getAccessToken } = useAuth();
  const [deviceCount, setDeviceCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      try {
        const token = await getAccessToken();

        const response = await fetch(`${BASE_URL}/devices`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load device count.");
        }

        const result = await response.json();

        if (active) {
          setDeviceCount(
            typeof result.count === "number"
              ? result.count
              : Array.isArray(result.devices)
                ? result.devices.length
                : 0
          );
        }
      } catch (error) {
        console.error("Device count error:", error);
      }
    }

    if (user) {
      loadCount();
    } else {
      setDeviceCount(0);
    }

    return () => {
      active = false;
    };
  }, [user, getAccessToken]);

  return deviceCount;
}
