export default function Reports() {
  return (
    <section className="content-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Reports</h1>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total irrigation</span>
          <strong>1,280 L</strong>
        </div>
        <div className="stat-card">
          <span>Average moisture</span>
          <strong>62%</strong>
        </div>
        <div className="stat-card">
          <span>Water efficiency</span>
          <strong>89%</strong>
        </div>
      </div>

      <div className="panel-grid">
        <div className="info-panel">
          <h3>Weekly summary</h3>
          <p>Soil moisture remained stable for 5 of 7 days, with a mild dip during the hottest afternoon period.</p>
        </div>
        <div className="info-panel">
          <h3>Recommended action</h3>
          <p>Reduce the watering window by 10 minutes during cooler mornings to preserve water without affecting hydration.</p>
        </div>
      </div>
    </section>
  );
}
