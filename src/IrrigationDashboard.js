import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Dashboard from "./components/Dashboard";
import { useAuth } from "./auth/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const LIVE_REFRESH_MS = 10000;
const HISTORY_REFRESH_MS = 60000;
const MAX_HISTORY_POINTS = 300;
const MAX_WATERING_EVENTS = 200;
const DEFAULT_SETTINGS = {
  autoMode: false,
  minIntervalHours: 24,
  wateringDuration: 10,
  thresholdMoisture: 30,
};

function deviceIdOf(device) {
  return typeof device === "string" ? device : device?.deviceId || device?.id || "";
}

function deviceNameOf(device) {
  return typeof device === "string"
    ? "Unnamed device"
    : device?.name || device?.Name || "Unnamed device";
}

function deviceEndpoint(path, deviceId) {
  const url = new URL(`${API_BASE_URL}/${path}`);
  url.searchParams.set("deviceId", deviceId);
  return url.toString();
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  }
  return body;
}

function ensureSelectedDevice(payload, selectedId) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => {
      const itemDeviceId = item?.deviceId || item?.device_id;
      return !itemDeviceId || itemDeviceId === selectedId;
    });
  }

  const responseDeviceId = payload?.deviceId || payload?.device_id;
  if (responseDeviceId && responseDeviceId !== selectedId) {
    throw new Error("The API returned data for a different device.");
  }

  for (const key of ["items", "history", "records", "data"]) {
    if (Array.isArray(payload?.[key])) {
      return {
        ...payload,
        [key]: payload[key].filter((item) => {
          const itemDeviceId = item?.deviceId || item?.device_id;
          return !itemDeviceId || itemDeviceId === selectedId;
        }),
      };
    }
  }

  return payload;
}

function limitSeries(payload, limit) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.history)
        ? payload.history
        : Array.isArray(payload?.records)
          ? payload.records
          : Array.isArray(payload?.data)
            ? payload.data
          : [];
  return rows.slice(-limit);
}

function App() {
  const { user, selectedDeviceId, selectDevice, getAccessToken } = useAuth();
  const [sensorData, setSensorData] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [wateringHistory, setWateringHistory] = useState([]);
  const [manualDuration, setManualDuration] = useState("");
  const [pumpStatus, setPumpStatus] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [devices, setDevices] = useState([]);
  const [deviceLoadError, setDeviceLoadError] = useState("");
  const [dashboardError, setDashboardError] = useState("");

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      setDeviceLoadError("");
      try {
        const body = await readJson(await authorizedFetch(`${API_BASE_URL}/devices`));
        const records = Array.isArray(body.devices) ? body.devices : [];
        if (!active) return;

        setDevices(records);
        const ids = records.map(deviceIdOf).filter(Boolean);
        selectDevice((currentId) => ids.includes(currentId) ? currentId : (ids[0] || null));
      } catch (error) {
        if (active) setDeviceLoadError(error.message || "Unable to load your devices.");
      }
    }

    if (user) loadDevices();
    else setDevices([]);

    return () => { active = false; };
  }, [authorizedFetch, user, selectDevice]);

  const loadDeviceResource = useCallback(async (path, deviceId, signal) => {
    const payload = await readJson(await authorizedFetch(deviceEndpoint(path, deviceId), { signal }));
    return ensureSelectedDevice(payload, deviceId);
  }, [authorizedFetch]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setSensorData(null);
      setHistory([]);
      setSettings(DEFAULT_SETTINGS);
      setPumpStatus(null);
      setWateringHistory([]);
      setDashboardError("");
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    const deviceId = selectedDeviceId;
    setSensorData(null);
    setHistory([]);
    setSettings(DEFAULT_SETTINGS);
    setPumpStatus(null);
    setWateringHistory([]);
    setDashboardError("");

    async function loadInitialData() {
      const resources = [
        ["latest-data", setSensorData],
        ["history", (value) => setHistory(limitSeries(value, MAX_HISTORY_POINTS))],
        ["settings", setSettings],
        ["pumpStatus", setPumpStatus],
        ["watering-history", (value) => setWateringHistory(limitSeries(value, MAX_WATERING_EVENTS))],
      ];
      const results = await Promise.allSettled(
        resources.map(([path]) => loadDeviceResource(path, deviceId, controller.signal))
      );

      if (!active) return;
      const errors = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          resources[index][1](result.value);
        } else if (result.reason?.name !== "AbortError") {
          errors.push(`${resources[index][0]}: ${result.reason?.message || "request failed"}`);
        }
      });
      if (errors.length) setDashboardError(errors.join(" "));
    }

    let initialLoadInProgress = true;
    let liveRefreshInProgress = false;
    let historyRefreshInProgress = false;

    async function refreshLiveData() {
      if (!active || initialLoadInProgress || liveRefreshInProgress) return;
      liveRefreshInProgress = true;
      const resources = [
        ["latest-data", setSensorData],
        ["pumpStatus", setPumpStatus],
      ];
      const results = await Promise.allSettled(
        resources.map(([path]) => loadDeviceResource(path, deviceId, controller.signal))
      );
      if (active) {
        results.forEach((result, index) => {
          if (result.status === "fulfilled") resources[index][1](result.value);
        });
      }
      liveRefreshInProgress = false;
    }

    async function refreshHistory() {
      if (!active || initialLoadInProgress || historyRefreshInProgress) return;
      historyRefreshInProgress = true;
      const resources = [
        ["history", (value) => setHistory(limitSeries(value, MAX_HISTORY_POINTS))],
        ["watering-history", (value) => setWateringHistory(limitSeries(value, MAX_WATERING_EVENTS))],
      ];
      const results = await Promise.allSettled(
        resources.map(([path]) => loadDeviceResource(path, deviceId, controller.signal))
      );
      if (active) {
        results.forEach((result, index) => {
          if (result.status === "fulfilled") resources[index][1](result.value);
        });
      }
      historyRefreshInProgress = false;
    }

    loadInitialData().finally(() => { initialLoadInProgress = false; });
    const liveInterval = setInterval(refreshLiveData, LIVE_REFRESH_MS);
    const historyInterval = setInterval(refreshHistory, HISTORY_REFRESH_MS);

    return () => {
      active = false;
      controller.abort();
      clearInterval(liveInterval);
      clearInterval(historyInterval);
    };
  }, [selectedDeviceId, loadDeviceResource]);

  useEffect(() => {
    if (!pumpStatus) return undefined;
    const updateRemaining = () => {
      if (pumpStatus.status !== "ON" || !pumpStatus.startTime) {
        setRemaining(0);
        return;
      }
      const elapsed = (Date.now() - new Date(pumpStatus.startTime).getTime()) / 1000;
      setRemaining(Math.max(0, Math.round(pumpStatus.duration - elapsed)));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [pumpStatus]);

  async function activatePump() {
    if (!selectedDeviceId) return;
    const duration = manualDuration === ""
      ? settings?.wateringDuration || 10
      : Number(manualDuration);
    try {
      const response = await authorizedFetch(deviceEndpoint("control", selectedDeviceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "ON", duration, source: "manual" }),
      });
      await readJson(response);
      window.alert("Command sent");
    } catch (error) {
      console.error("Pump command failed:", error);
      window.alert(error.message || "Error sending command");
    }
  }

  async function saveSettings() {
    if (!selectedDeviceId) return;
    try {
      const response = await authorizedFetch(deviceEndpoint("settings", selectedDeviceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      await readJson(response);
      window.alert("Settings saved");
    } catch (error) {
      console.error("Saving device settings failed:", error);
      window.alert(error.message || "Error saving settings");
    }
  }

  const selectedDevice = devices.find((device) => deviceIdOf(device) === selectedDeviceId);
  const selectedDeviceName = selectedDevice ? deviceNameOf(selectedDevice) : "Select a device";

  if (!selectedDeviceId) {
    return (
      <section className="content-page">
        <div className="page-header">
          <div><p className="eyebrow">Device dashboard</p><h1>Select a device</h1></div>
        </div>
        <div className="info-panel">
          <p>Choose a device to open its dashboard.</p>
          {deviceLoadError && <p className="error-box" role="alert">{deviceLoadError}</p>}
          {devices.length ? <div className="device-list">
            {devices.map((device) => {
              const id = deviceIdOf(device);
              return <div className="device-card" key={id}>
                <div><strong>{deviceNameOf(device)}</strong></div>
                <button type="button" onClick={() => selectDevice(id)}>View dashboard</button>
              </div>;
            })}
          </div> : <div>
            <p>No devices are linked to your account yet. Add a device to get started.</p>
            <Link to="/devices" className="btn btn-primary">Go to devices</Link>
          </div>}
        </div>
      </section>
    );
  }

  return (
    <section className="content-page">
      <div className="page-header dashboard-page-header">
        <div>
          <p className="eyebrow">Device dashboard</p>
          <h1>{selectedDeviceName}</h1>
        </div>
        {devices.length > 1 && (
          <label className="dashboard-device-select">
            <span>Device</span>
            <select value={selectedDeviceId} onChange={(event) => selectDevice(event.target.value)}>
              {devices.map((device) => {
                const id = deviceIdOf(device);
                return <option key={id} value={id}>{deviceNameOf(device)}</option>;
              })}
            </select>
          </label>
        )}
      </div>
      {deviceLoadError && <p className="error-box" role="alert">{deviceLoadError}</p>}
      {dashboardError && <p className="error-box" role="alert">Some data could not be loaded for {selectedDeviceName}: {dashboardError}</p>}
      <Dashboard
        data={sensorData}
        history={history}
        activatePump={activatePump}
        settings={settings}
        wateringHistory={wateringHistory}
        setSettings={setSettings}
        saveSettings={saveSettings}
        manualDuration={manualDuration}
        setManualDuration={setManualDuration}
        pumpStatus={pumpStatus}
        remaining={remaining}
        dashboardError={dashboardError}
      />
    </section>
  );
}

export default App;
