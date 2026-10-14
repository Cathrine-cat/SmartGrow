export default function Settings() {
  return (
    <section className="content-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="panel-grid">
        <div className="info-panel">
          <h3>Watering configuration</h3>
          <ul className="settings-list">
            <li>Auto mode: Enabled</li>
            <li>Minimum interval: 24 hours</li>
            <li>Watering duration: 10 minutes</li>
            <li>Moisture threshold: 30%</li>
          </ul>
        </div>

        <div className="info-panel">
          <h3>System preferences</h3>
          <ul className="settings-list">
            <li>Notifications: On</li>
            <li>Email alerts: Active</li>
            <li>Timezone: Europe/Bucharest</li>
            <li>Schedule: Morning</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
