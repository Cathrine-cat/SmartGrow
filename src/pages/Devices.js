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
  const [showClaimPassword, setShowClaimPassword] = useState(false);
  const [verifiedId, setVerifiedId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    location: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [deviceMessage, setDeviceMessage] = useState("");
  const [deviceMessageType, setDeviceMessageType] = useState("success");
  const [editError, setEditError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const body = await responseBody(
      await authorizedFetch(DEVICES_URL)
    );
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
      if (body.exists === false || body.found === false) {
        throw new Error("This device was not found or is not available to claim. It may already be linked or not fully provisioned.");
      }
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
  if (!window.confirm(`Unlink device ${id} from your account?`)) {
    return;
  }

  setBusy(true);
  setDeviceMessage("");

  try {
    await responseBody(
      await authorizedFetch(
        `${DEVICES_URL}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      )
    );

    await removeDevice(id);
    setDevices((current) =>
      current.filter((item) => deviceIdOf(item) !== id)
    );

    if (selectedDeviceId === id) {
      const remainingDevices = devices.filter(
        (item) => deviceIdOf(item) !== id
      );
      selectDevice(
        remainingDevices.length
          ? deviceIdOf(remainingDevices[0])
          : null
      );
    }

    setDeviceMessage("Device unlinked successfully.");
    setDeviceMessageType("success");
  } catch (error) {
    setDeviceMessageType("error");
    setDeviceMessage(error.message || "Unable to unlink device.");
  } finally {
    setBusy(false);
  }
}


  function beginEdit(device) {
  const id = deviceIdOf(device);

  setEditingId(id);
  setEditForm({
    name: device?.name || device?.Name || "",
    location: device?.location || device?.Location || "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  setEditError("");
  setChangingPassword(false);
  setCurrentPasswordVerified(false);
  setShowCurrentPassword(false);
  setShowNewPassword(false);
  setShowConfirmPassword(false);
}

  async function verifyCurrentDevicePassword() {
    setEditError("");
    if (!editForm.currentPassword) {
      setEditError("Enter the current device password.");
      return;
    }

    setBusy(true);
    try {
      const body = await responseBody(
        await authorizedFetch(
          `${DEVICES_URL}/${encodeURIComponent(editingId)}/verify-password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword: editForm.currentPassword }),
          }
        )
      );
      if (body.valid !== true && body.verified !== true) {
        throw new Error("Current device password is incorrect.");
      }
      setCurrentPasswordVerified(true);
      setEditError("");
    } catch (error) {
      setCurrentPasswordVerified(false);
      setEditError(error.message || "Unable to verify the current device password.");
    } finally {
      setBusy(false);
    }
  }

async function saveDevice(event) {
  event.preventDefault();
  setBusy(true);
  setEditError("");
  setDeviceMessage("");

  try {
    const device = devices.find((item) => deviceIdOf(item) === editingId);
    const originalName = device?.name || device?.Name || "";
    const originalLocation = device?.location || device?.Location || "";
    const nextName = editForm.name.trim();
    const nextLocation = editForm.location.trim();
    const payload = {};

    if (nextName !== originalName) {
      if (!nextName) throw new Error("Device name cannot be empty.");
      payload.name = nextName;
    }
    if (nextLocation !== originalLocation) payload.location = nextLocation;

    if (editForm.newPassword || editForm.confirmNewPassword) {
      if (!changingPassword || !currentPasswordVerified) {
        throw new Error("Verify the current device password before setting a new one.");
      }
      if (!editForm.newPassword || !editForm.confirmNewPassword) {
        throw new Error("Enter and confirm the new device password.");
      }
      if (editForm.newPassword !== editForm.confirmNewPassword) {
        throw new Error("The new passwords do not match.");
      }

      payload.currentPassword = editForm.currentPassword;
      payload.newPassword = editForm.newPassword;
    }
    if (!Object.keys(payload).length) {
      throw new Error("Change the name, location, or password before saving.");
    }

    const body = await responseBody(
      await authorizedFetch(
        `${DEVICES_URL}/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
    );

    const updated = safeDevice(body.device);

    setDevices((current) =>
      current.map((item) =>
        deviceIdOf(item) === editingId ? updated : item
      )
    );

    setEditingId(null);
    setDeviceMessage("Device details updated.");
    setDeviceMessageType("success");
  } catch (error) {
    setEditError(error.message || "Unable to update device.");
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
              <label>
                <span>Device password</span>
                <div className="password-input-row">
                  <input required type={showClaimPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                  <button type="button" className="password-toggle" aria-label={showClaimPassword ? "Hide password" : "Show password"} aria-pressed={showClaimPassword} onClick={() => setShowClaimPassword((shown) => !shown)}>{showClaimPassword ? "Hide" : "Show"}</button>
                </div>
              </label>
              <button type="submit" className="submit-button" disabled={busy}>{busy ? "Linking..." : "Verify and add"}</button>
              <button type="button" className="ghost-button" onClick={() => { setVerifiedId(""); setPassword(""); setShowClaimPassword(false); }}>Use another ID</button>
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
                      {!changingPassword ? (
                        <button type="button" className="ghost-button" onClick={() => { setChangingPassword(true); setCurrentPasswordVerified(false); setEditError(""); }}>
                          Change password
                        </button>
                      ) : (
                        <>
                          <label>
                            <span>Current device password</span>
                            <div className="password-input-row">
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={editForm.currentPassword}
                                onChange={(event) => {
                                  setEditForm({ ...editForm, currentPassword: event.target.value, newPassword: "", confirmNewPassword: "" });
                                  setCurrentPasswordVerified(false);
                                  setEditError("");
                                }}
                                autoComplete="current-password"
                                disabled={busy}
                              />
                              <button type="button" className="password-toggle" aria-label={showCurrentPassword ? "Hide password" : "Show password"} aria-pressed={showCurrentPassword} onClick={() => setShowCurrentPassword((shown) => !shown)}>{showCurrentPassword ? "Hide" : "Show"}</button>
                            </div>
                          </label>
                          {!currentPasswordVerified ? (
                            <button type="button" className="ghost-button" onClick={verifyCurrentDevicePassword} disabled={busy}>
                              {busy ? "Checking..." : "Verify current password"}
                            </button>
                          ) : (
                            <>
                              <p className="success-text" role="status">Current password verified.</p>
                              <label>
                                <span>New device password</span>
                                <div className="password-input-row">
                                  <input type={showNewPassword ? "text" : "password"} value={editForm.newPassword} onChange={(event) => setEditForm({ ...editForm, newPassword: event.target.value })} autoComplete="new-password" disabled={busy} />
                                  <button type="button" className="password-toggle" aria-label={showNewPassword ? "Hide password" : "Show password"} aria-pressed={showNewPassword} onClick={() => setShowNewPassword((shown) => !shown)}>{showNewPassword ? "Hide" : "Show"}</button>
                                </div>
                              </label>
                              <label>
                                <span>Confirm new device password</span>
                                <div className="password-input-row">
                                  <input type={showConfirmPassword ? "text" : "password"} value={editForm.confirmNewPassword} onChange={(event) => setEditForm({ ...editForm, confirmNewPassword: event.target.value })} autoComplete="new-password" disabled={busy} aria-describedby="device-password-match" />
                                  <button type="button" className="password-toggle" aria-label={showConfirmPassword ? "Hide password" : "Show password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((shown) => !shown)}>{showConfirmPassword ? "Hide" : "Show"}</button>
                                </div>
                              </label>
                              {editForm.confirmNewPassword && (
                                <p id="device-password-match" className={editForm.newPassword === editForm.confirmNewPassword ? "success-text" : "field-help"} role="status">
                                  {editForm.newPassword === editForm.confirmNewPassword ? "Passwords match." : "Passwords do not match yet."}
                                </p>
                              )}
                              <button type="button" className="ghost-button" onClick={() => { setChangingPassword(false); setCurrentPasswordVerified(false); setEditForm({ ...editForm, currentPassword: "", newPassword: "", confirmNewPassword: "" }); setEditError(""); setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false); }}>
                                Cancel password change
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {editError && <p className="error-box" role="alert">{editError}</p>}
                      <button type="submit" disabled={busy}>Save changes</button>
                      <button type="button" className="ghost-button" onClick={() => { setEditingId(null); setEditError(""); setChangingPassword(false); setCurrentPasswordVerified(false); }}>Cancel</button>
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
          {deviceMessage && <p className={deviceMessageType === "error" ? "error-box" : "success-text"} role={deviceMessageType === "error" ? "alert" : "status"}>{deviceMessage}</p>}
          {selectedDeviceId && <Link to="/dashboard" className="btn btn-primary device-link">View selected dashboard</Link>}
        </div>
      </div>
    </section>
  );
}
