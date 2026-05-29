import SoilChart from "./SoilChart";

function Dashboard({ data, history, activatePump }) {

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
          Temperature:
          {data.temperature} °C
        </p>

        <p>
          Humidity:
          {data.humidity} %
        </p>

        <p>
          Soil Moisture:
          {data.soil}
        </p>

        <p>
          Light:
          {data.light}
        </p>

      </div>

      <button onClick={activatePump}>
        Activate Pump
      </button>

      <div style={{ width: "700px", margin: "50px auto" }}>
        <SoilChart history={history} />
      </div>

    </div>
  );
}

export default Dashboard;