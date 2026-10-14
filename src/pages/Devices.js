import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Devices() {
  const { user, addDevice, removeDevice, selectedDeviceId, selectDevice } = useAuth();
  const [deviceId, setDeviceId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const devices = Array.isArray(user?.devices) ? user.devices : [];

  async function handleAddDevice(event) {
    event.preventDefault();
    setMessage("");
    setMessageType("success");

    try {
      await addDevice(deviceId);
      setDeviceId("");
      setMessage("Device added successfully.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to add device.");
    }
  }

  async function handleRemoveDevice(id) {
    try {
      await removeDevice(id);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to remove device.");
    }
  }

  return (
    <section className="content-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Control</p>
          <h1>Devices</h1>
        </div>
      </div>

      <div className="panel-grid">
        <div className="info-panel">
          <h3>Add a device</h3>
          <form className="device-form" onSubmit={handleAddDevice}>
            <label>
              <span>Device ID</span>
              <input
                type="text"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                placeholder="Example: device-101"
              />
            </label>

            <button type="submit" className="submit-button">Add device</button>
          </form>

          {message && <p className={messageType === "error" ? "error-box" : "success-text"} role="status">{message}</p>}
        </div>

        <div className="info-panel">
          <h3>My devices</h3>
          {devices.length ? (
            <div className="device-list">
              {devices.map((item) => (
                <div
                  key={item}
                  className={selectedDeviceId === item ? "device-card active-device" : "device-card"}
                >
                  <div>
                    <strong>{item}</strong>
                    <p>{selectedDeviceId === item ? "Currently selected" : "Available"}</p>
                  </div>

                  <div className="device-actions">
                    <button type="button" onClick={() => selectDevice(item)}>
                      Select
                    </button>
                    <button type="button" className="ghost-button" onClick={() => handleRemoveDevice(item)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No devices yet. Add your first irrigation device by ID.</p>
          )}

          {selectedDeviceId && (
            <Link to="/dashboard" className="btn btn-primary device-link">
              View selected dashboard
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
