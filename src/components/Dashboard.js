import SoilChart from "./SoilChart";
import SettingsPanel from "./SettingsPanel";

function Dashboard({ data,
  history,
  activatePump,
  settings,
  setSettings,
  saveSettings,
  manualDuration,
  setManualDuration }) {

  if (!data) {
    return <h1>Loading...</h1>;
  }

  return (

    <div className="container">

      <h1>
        Smart Irrigation Dashboard
      </h1>

      <div className="card">

        <p>
          🌡️ Temperature:
          {data.temperature} °C
        </p>

        <p>
          💧 Humidity:
          {data.humidity} %
        </p>

        <p>
          🌱 Soil Moisture:
          {data.soil}
        </p>

        <p>
          🌞 Light:
          {data.light}
        </p>

      </div>

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

      <SettingsPanel
      settings={settings}

      setSettings={setSettings}

      saveSettings={
        saveSettings}
      />

      <div style={{ width: "700px", margin: "50px auto" }}>
        <SoilChart history={history} />
      </div>

    </div>
  );
}

export default Dashboard;