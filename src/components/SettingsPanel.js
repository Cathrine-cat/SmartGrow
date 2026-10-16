function SettingsPanel({
  settings,
  setSettings,
  saveSettings
}) {

  return (

    <div className="card">

      <h2>
        Irrigation Settings
      </h2>

      <label>

        Automatic Mode

        <input
          type="checkbox"

          checked={
            settings.autoMode
          }

          onChange={(e) =>
            setSettings({
              ...settings,

              autoMode:
                e.target.checked
            })
          }
        />

      </label>

      <br />
      <br />

      <label>

        Minimum Interval
        (hours)

        <input
          type="number"

          value={
            settings.minIntervalHours
          }

          onChange={(e) =>
            setSettings({
              ...settings,

              minIntervalHours:
                Number(
                  e.target.value
                )
            })
          }
        />

      </label>

      <br />
      <br />

      <label>

        Watering Duration

        <select

          value={
            settings.wateringDuration
          }

          onChange={(e) =>
            setSettings({
              ...settings,

              wateringDuration:
                Number(
                  e.target.value
                )
            })
          }
        >

          <option value={10}>
            10 sec
          </option>

          <option value={15}>
            15 sec
          </option>

          <option value={20}>
            20 sec
          </option>

        </select>

      </label>

      <br />
      <br />

      <label>
        Soil Moisture Threshold (%)

        <input
          type="number"
          min="0"
          max="100"
          step="1"
          inputMode="numeric"
          value={settings.thresholdMoisture}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              setSettings({ ...settings, thresholdMoisture: "" });
            } else if (/^\d+$/.test(value)) {
              setSettings({ ...settings, thresholdMoisture: Math.min(100, Number(value)) });
            }
          }}
        />

      <span>Enter a whole number from 0 to 100.</span>
      </label>

      <br />
      <br />

      <button
        onClick={saveSettings}
      >
        Save Settings
      </button>

    </div>

  );
}

export default SettingsPanel;
