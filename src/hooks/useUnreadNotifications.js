
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";

export default function useUnreadNotifications() {
  const { user, getAccessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Could not load notification count.");
      }

      const body = await response.json();
      if (Array.isArray(body.notifications)) {
        const unread = body.notifications.filter((item) => item.read !== true && item.read !== "true");
        setUnreadCount(unread.length);
      } else {
        setUnreadCount(Number(body.unreadCount) || 0);
      }
    } catch (error) {
      console.error("Notification count error:", error);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    refreshUnreadCount();

    if (!user) return undefined;

    const interval = setInterval(refreshUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  return { unreadCount, refreshUnreadCount };
}
