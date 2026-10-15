import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const DEVICES_URL = `${API_BASE_URL}/devices`;

function deviceIdOf(device) {
  return typeof device === "string" ? device : device?.deviceId || device?.id || device?.serialNumber || "";
}

function safeDevice(device) {
  if (!device || typeof device !== "object") return device;
  const safe = { ...device };
  delete safe.password;
  delete safe.passwordHash;
  delete safe.credential;
  return safe;
}

async function responseBody(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  return body;
}

export default function Devices() {
  const { user, addDevice, removeDevice, selectedDeviceId, selectDevice, getAccessToken } = useAuth();
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [password, setPassword] = useState("");
  const [verifiedId, setVerifiedId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", location: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(DEVICES_URL);
      url.searchParams.set("userId", user.sub || user.id);
      const body = await responseBody(await authorizedFetch(url.toString()));
      const records = body.devices || body.items || body.Items || body;
      const safeRecords = Array.isArray(records) ? records.map(safeDevice) : [];
      setDevices(safeRecords);
      const ids = safeRecords.map(deviceIdOf).filter(Boolean);
      if (!ids.includes(selectedDeviceId)) selectDevice(ids[0] || null);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to load devices.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, selectDevice, selectedDeviceId, user]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  async function handleCheckDevice(event) {
    event.preventDefault();
    setMessage("");
    const id = deviceId.trim();
    if (!id) return;
    setBusy(true);
    try {
      const url = new URL(`${DEVICES_URL}/verify`);
      url.searchParams.set("deviceId", id);
      const body = await responseBody(await authorizedFetch(url.toString()));
      if (body.exists === false || body.found === false) throw new Error("No device with that ID was found.");
      setVerifiedId(id);
      setMessage("Device found. Enter its device password to link it to your account.");
      setMessageType("success");
    } catch (error) {
      setVerifiedId("");
      setMessageType("error");
      setMessage(error.message || "Unable to check that device ID.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimDevice(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const body = await responseBody(await authorizedFetch(`${DEVICES_URL}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: verifiedId, password }),
      }));
      const device = safeDevice(body.device || { deviceId: verifiedId });
      setDevices((current) => [...current.filter((item) => deviceIdOf(item) !== verifiedId), device]);
      await addDevice(verifiedId);
      selectDevice(verifiedId);
      setDeviceId("");
      setPassword("");
      setVerifiedId("");
      setMessage("Device linked to your account.");
      setMessageType("success");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to link device.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDevice(id) {
    setBusy(true);
    setMessage("");
    try {
      await responseBody(await authorizedFetch(DEVICES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", deviceId: id }),
      }));
      await removeDevice(id);
      setDevices((current) => current.filter((item) => deviceIdOf(item) !== id));
      setMessage("Device removed.");
      setMessageType("success");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to remove device.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(device) {
    const id = deviceIdOf(device);
    setEditingId(id);
    setEditForm({ name: device?.name || device?.Name || "", location: device?.location || device?.Location || "", password: "" });
  }

  async function saveDevice(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload = { action: "update", deviceId: editingId, name: editForm.name.trim(), location: editForm.location.trim() };
    if (editForm.password) payload.password = editForm.password;
    try {
      const body = await responseBody(await authorizedFetch(DEVICES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      const updated = safeDevice(body.device || { ...devices.find((item) => deviceIdOf(item) === editingId), ...payload });
      delete updated.action;
      delete updated.password;
      setDevices((current) => current.map((item) => deviceIdOf(item) === editingId ? updated : item));
      setEditingId(null);
      setMessage("Device details updated.");
      setMessageType("success");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-page">
      <div className="page-header"><div><p className="eyebrow">Control</p><h1>Devices</h1></div></div>
      <div className="panel-grid">
        <div className="info-panel">
          <h3>Add a device</h3>
          {!verifiedId ? (
            <form className="device-form" onSubmit={handleCheckDevice}>
              <label><span>Device ID</span><input required value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="Example: device-101" /></label>
              <button type="submit" className="submit-button" disabled={busy}>{busy ? "Checking..." : "Check device ID"}</button>
            </form>
          ) : (
            <form className="device-form" onSubmit={handleClaimDevice}>
              <p>Device <strong>{verifiedId}</strong> was found.</p>
              <label><span>Device password</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
              <button type="submit" className="submit-button" disabled={busy}>{busy ? "Linking..." : "Verify and add"}</button>
              <button type="button" className="ghost-button" onClick={() => { setVerifiedId(""); setPassword(""); }}>Use another ID</button>
            </form>
          )}
          {message && <p className={messageType === "error" ? "error-box" : "success-text"} role="status">{message}</p>}
        </div>

        <div className="info-panel">
          <h3>My devices</h3>
          {loading ? <p>Loading devices...</p> : devices.length ? (
            <div className="device-list">
              {devices.map((device) => {
                const id = deviceIdOf(device);
                const isEditing = editingId === id;
                return <div key={id} className={selectedDeviceId === id ? "device-card active-device" : "device-card"}>
                  <div className="device-card-content">
                    <strong>{device?.name || device?.Name || id}</strong>
                    <p>ID: {id}{(device?.location || device?.Location) ? ` · ${device.location || device.Location}` : ""}</p>
                    {selectedDeviceId === id && <p>Currently selected</p>}
                    {isEditing && <form className="device-form device-edit-form" onSubmit={saveDevice}>
                      <label><span>Name</span><input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
                      <label><span>Location</span><input value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} /></label>
                      <label><span>New device password (optional)</span><input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} autoComplete="new-password" /></label>
                      <button type="submit" disabled={busy}>Save changes</button>
                      <button type="button" className="ghost-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>}
                  </div>
                  {!isEditing && <div className="device-actions">
                    <button type="button" onClick={() => selectDevice(id)}>Select</button>
                    <button type="button" className="ghost-button" onClick={() => beginEdit(device)}>Edit</button>
                    <button type="button" className="ghost-button" disabled={busy} onClick={() => handleRemoveDevice(id)}>Remove</button>
                  </div>}
                </div>;
              })}
            </div>
          ) : <p>No linked devices. Add one using its device ID and password.</p>}
          {selectedDeviceId && <Link to="/dashboard" className="btn btn-primary device-link">View selected dashboard</Link>}
        </div>
      </div>
    </section>
  );
}
