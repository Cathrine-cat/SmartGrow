import SoilChart from "./SoilChart";
import SettingsPanel from "./SettingsPanel";
import WateringHistoryChart from "./WateringHistoryChart";

function Dashboard({ data,
  history,
  wateringHistory,
  activatePump,
  settings,
  setSettings,
  saveSettings,
  manualDuration,
  setManualDuration,
  pumpStatus,
  remaining,
  dashboardError,
}) {

  if (!data) {
    return (
      <div className="dashboard-loading card" role="status">
        {dashboardError ? "Sensor readings could not be loaded." : "Loading device data…"}
      </div>
    );
  }

  return (
  <div className="dashboard">

    <p className="dashboard-subtitle">Live readings and irrigation controls</p>

    <div className="grid">
      
      {/* LEFT COLUMN */}
      <div className="column">

        <div className="card">
          <p>🌡️ Temperature: {data.temperature} °C</p>
          <p>💧 Humidity: {data.humidity} %</p>
          <p>🌱 Soil Moisture: {data.soil}</p>
          <p>🌞 Light: {data.light}</p>
        </div>

        <div className="card">
          <h3>Pump Status</h3>

          {!pumpStatus ? (
            <p>No pump data</p>
          ) : (
            <>
              <p>
                Status: {pumpStatus.isActuallyOn ? "ON" : "OFF"}
              </p>

              <p>Source: {pumpStatus.source}</p>
              <p>Duration: {pumpStatus.duration}s</p>

              {pumpStatus.isActuallyOn && remaining > 0 && (
                <p>Remaining: {remaining}s</p>
              )}

              {pumpStatus.isActuallyOn ? (
                <p style={{ color: "green" }}>
                  🟢 Pump running
                </p>
              ) : (
                <p style={{ color: "gray" }}>
                  ⚪ Pump idle
                </p>
              )}
            </>
          )}
        </div>

        
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          saveSettings={saveSettings}
        />

        <div className="card">
          <h3>Manual Watering</h3>

          <input
            type="number"
            min="0"
            step="1"
            placeholder="Duration (seconds)"
            value={manualDuration}
            onChange={(e) => {
              const value = e.target.value;
              setManualDuration(value === "" ? "" : String(Math.max(0, Math.floor(Number(value) || 0))));
            }}
          />

          <button onClick={activatePump}>
            Activate Pump
          </button>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="column">

        <div className="chart-container">
          <h2>Soil Moisture History</h2>
          <SoilChart history={history} />
        </div>

        <div className="chart-container">
          <h2>Watering History</h2>
          <WateringHistoryChart
            history={wateringHistory}
          />
        </div>

      </div>

    </div>
  </div>
);
}

export default Dashboard;
