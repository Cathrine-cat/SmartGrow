export default function Alerts() {
  return (
    <section className="content-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Monitoring</p>
          <h1>Alerts</h1>
        </div>
      </div>

      <div className="alert-list">
        <div className="alert-item warning">
          <strong>Low moisture</strong>
          <span>Zone A has dropped below the threshold for 18 minutes.</span>
        </div>

        <div className="alert-item ok">
          <strong>Pump status</strong>
          <span>System is running normally and within safe operating range.</span>
        </div>

        <div className="alert-item info">
          <strong>Maintenance reminder</strong>
          <span>Check filter cartridge in 3 days.</span>
        </div>
      </div>
    </section>
  );
}
