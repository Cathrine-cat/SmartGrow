import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";
const CHAT_URL = `${API_BASE_URL}/plant-assistant`;
const LATEST_URL = `${API_BASE_URL}/latest-data`;
const MAX_VISIBLE_MESSAGES = 20;
const MAX_CONTEXT_MESSAGES = 12;

function deviceIdOf(device) {
  return typeof device === "string" ? device : device?.deviceId || device?.id || "";
}

function deviceNameOf(device) {
  return typeof device === "string" ? "Unnamed device" : device?.name || device?.Name || "Unnamed device";
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  return body;
}

export default function PlantAssistant() {
  const { user, selectedDeviceId, selectDevice, getAccessToken } = useAuth();
  const [devices, setDevices] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hi! Tell me what plant you’re growing and what you’re noticing. I can use the selected device’s latest readings to help with watering and plant care.",
  }]);
  const [input, setInput] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  useEffect(() => {
    let active = true;
    async function loadDevices() {
      setLoadingDevices(true);
      try {
        const body = await readJson(await authorizedFetch(`${API_BASE_URL}/devices`));
        const records = Array.isArray(body.devices) ? body.devices : [];
        if (!active) return;
        setDevices(records);
        const ids = records.map(deviceIdOf).filter(Boolean);
        selectDevice((currentId) => ids.includes(currentId) ? currentId : (ids[0] || null));
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load your devices.");
      } finally {
        if (active) setLoadingDevices(false);
      }
    }
    if (user) loadDevices();
    else setLoadingDevices(false);
    return () => { active = false; };
  }, [authorizedFetch, user, selectDevice]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setLatestData(null);
      return undefined;
    }
    const controller = new AbortController();
    const url = new URL(LATEST_URL);
    url.searchParams.set("deviceId", selectedDeviceId);
    setLatestData(null);
    setLoadingReadings(true);

    authorizedFetch(url.toString(), { signal: controller.signal })
      .then(readJson)
      .then(setLatestData)
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setLatestData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingReadings(false);
      });

    return () => controller.abort();
  }, [selectedDeviceId, authorizedFetch]);

  const selectedDevice = devices.find((device) => deviceIdOf(device) === selectedDeviceId);

  async function sendMessage(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    if (!selectedDeviceId) {
      setError("Link and select a device before asking about its readings.");
      return;
    }

    const conversation = [...messages, { role: "user", content: question }].slice(-MAX_VISIBLE_MESSAGES);
    setMessages(conversation);
    setInput("");
    setError("");
    setSending(true);

    try {
      const response = await authorizedFetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-MAX_CONTEXT_MESSAGES),
          deviceId: selectedDeviceId,
          plantContext: {
            deviceName: selectedDevice ? deviceNameOf(selectedDevice) : "",
            readings: latestData ? {
              temperature: latestData.temperature,
              humidity: latestData.humidity,
              soilMoisture: latestData.soil,
              light: latestData.light,
              timestamp: latestData.timestamp,
            } : null,
          },
        }),
      });
      const body = await readJson(response);
      if (typeof body.reply !== "string" || !body.reply.trim()) {
        throw new Error("The assistant returned an empty reply.");
      }
      setMessages((current) => [...current, { role: "assistant", content: body.reply }].slice(-MAX_VISIBLE_MESSAGES));
    } catch (sendError) {
      setError(sendError.message || "Could not reach the plant assistant.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="content-page assistant-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Plant care</p>
          <h1>Plant assistant</h1>
          <p className="assistant-intro">Ask about watering, soil moisture, light, or symptoms. Include the plant type and growing conditions for more useful guidance.</p>
        </div>
        {devices.length > 1 && (
          <label className="dashboard-device-select">
            <span>Use readings from</span>
            <select value={selectedDeviceId || ""} onChange={(event) => selectDevice(event.target.value)}>
              {devices.map((device) => <option key={deviceIdOf(device)} value={deviceIdOf(device)}>{deviceNameOf(device)}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && <p className="error-box" role="alert">{error}</p>}

      {loadingDevices ? <div className="info-panel"><p>Loading devices…</p></div> : !devices.length ? (
        <div className="info-panel">
          <p>Link a device to ask questions using its latest readings.</p>
          <Link to="/devices" className="btn btn-primary">Go to devices</Link>
        </div>
      ) : (
        <div className="assistant-panel">
          <div className="assistant-context" aria-live="polite">
            <strong>{selectedDevice ? deviceNameOf(selectedDevice) : "Choose a device"}</strong>
            <span>{loadingReadings ? "Loading latest readings…" : latestData ? `Soil ${latestData.soil ?? "—"}% · ${latestData.temperature ?? "—"}°C · Humidity ${latestData.humidity ?? "—"}%` : "No current readings available"}</span>
          </div>
          <div className="assistant-messages" aria-live="polite" aria-label="Conversation">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`assistant-message ${message.role === "user" ? "assistant-message-user" : "assistant-message-bot"}`}>
                <span className="assistant-message-label">{message.role === "user" ? "You" : "Plant assistant"}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {sending && <div className="assistant-message assistant-message-bot"><span className="assistant-message-label">Plant assistant</span><p>Thinking…</p></div>}
          </div>
          <form className="assistant-composer" onSubmit={sendMessage}>
            <label htmlFor="plant-question">Your question</label>
            <textarea
              id="plant-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="What plant are you growing, and what would you like help with?"
              maxLength={1000}
              rows={3}
              disabled={sending || !selectedDeviceId}
            />
            <div className="assistant-composer-footer">
              <span>{input.length}/1000</span>
              <button type="submit" className="submit-button" disabled={sending || !input.trim() || !selectedDeviceId}>
                {sending ? "Sending…" : "Ask assistant"}
              </button>
            </div>
          </form>
          <p className="assistant-note">The assistant offers general plant-care guidance. Tell it the plant species, pot or garden setup, and recent changes for better suggestions.</p>
        </div>
      )}
    </section>
  );
}
