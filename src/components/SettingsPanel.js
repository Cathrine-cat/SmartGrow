function SettingsPanel({ settings, setSettings, saveSettings }) {
  const threshold = settings.thresholdMoisture;
  const sliderValue = threshold === "" ? 0 : Number(threshold);

  function updateSetting(name, value) {
    setSettings({ ...settings, [name]: value });
  }

  function updateThreshold(value) {
    if (value === "") {
      updateSetting("thresholdMoisture", "");
      return;
    }

    updateSetting("thresholdMoisture", Math.min(100, Math.max(0, Number(value))));
  }

  return (
    <section className="card settings-panel" aria-labelledby="irrigation-settings-title">
      <div className="settings-panel-heading">
        <div>
          <p className="eyebrow">CONTROL YOUR GARDEN</p>
          <h2 id="irrigation-settings-title">Irrigation settings</h2>
        </div>
        <span className="settings-panel-icon" aria-hidden="true">⚙</span>
      </div>

      <div className="settings-form">
        <label className="settings-toggle-row" htmlFor="auto-mode">
          <span>
            <strong>Automatic mode</strong>
            <small>Water automatically when the soil is too dry.</small>
          </span>
          <input
            id="auto-mode"
            type="checkbox"
            checked={Boolean(settings.autoMode)}
            onChange={(event) => updateSetting("autoMode", event.target.checked)}
          />
        </label>

        <div className="settings-field-grid">
          <label className="settings-field" htmlFor="minimum-interval">
            <span className="settings-field-title">Minimum interval</span>
            <span className="settings-field-help">Time between watering cycles</span>
            <span className="settings-input-with-unit">
              <input
                id="minimum-interval"
                type="number"
                min="0"
                step="1"
                value={settings.minIntervalHours}
                onChange={(event) => updateSetting("minIntervalHours", Number(event.target.value))}
              />
              <span>hours</span>
            </span>
          </label>

          <label className="settings-field" htmlFor="watering-duration">
            <span className="settings-field-title">Watering duration</span>
            <span className="settings-field-help">How long the pump runs each time</span>
            <span className="settings-select-wrap">
              <select
                id="watering-duration"
                value={settings.wateringDuration}
                onChange={(event) => updateSetting("wateringDuration", Number(event.target.value))}
              >
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
                <option value={20}>20 seconds</option>
              </select>
            </span>
          </label>
        </div>

        <div className="settings-threshold">
          <div className="settings-threshold-heading">
            <div>
              <label className="settings-field-title" htmlFor="moisture-slider">Soil moisture threshold</label>
              <p className="settings-field-help">Start watering when moisture falls below this level.</p>
            </div>
            <label className="settings-threshold-number" htmlFor="moisture-number">
              <input
                id="moisture-number"
                type="number"
                min="0"
                max="100"
                step="1"
                inputMode="numeric"
                value={threshold}
                aria-label="Soil moisture threshold percentage"
                onChange={(event) => updateThreshold(event.target.value)}
              />
              <span>%</span>
            </label>
          </div>

          <input
            id="moisture-slider"
            className="settings-range"
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderValue}
            aria-label="Adjust soil moisture threshold"
            aria-valuetext={`${sliderValue}%`}
            style={{ "--range-progress": `${sliderValue}%` }}
            onChange={(event) => updateThreshold(event.target.value)}
          />
          <div className="settings-range-labels" aria-hidden="true">
            <span>0% · Drier soil</span>
            <span>100% · Wetter soil</span>
          </div>
        </div>

        <div className="settings-save-row">
          <span>Changes take effect after saving.</span>
          <button type="button" onClick={saveSettings}>Save settings</button>
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
