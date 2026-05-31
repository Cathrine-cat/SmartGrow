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
 remaining }) {

  if (!data) {
    return <h1>Loading...</h1>;
  }

  return (
  <div className="dashboard">

    <h1 className="title">
      Smart Irrigation Dashboard
    </h1>

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
            placeholder="Duration (seconds)"
            value={manualDuration}
            onChange={(e) =>
              setManualDuration(e.target.value)
            }
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