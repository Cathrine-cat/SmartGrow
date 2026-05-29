import { useEffect, useState } from "react";

import Dashboard from "./components/Dashboard";

function App() {

  const [sensorData, setSensorData] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const API_URL =
    "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com/latest-data";

  const HISTORY_URL =
    "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com/history";

  async function fetchData() {

    try {

      const response =
        await fetch(API_URL);

      const data =
        await response.json();

      console.log("LATEST:", data);

      setSensorData(data);

    } catch (error) {

      console.error(
        "Latest data error:",
        error
      );
    }
  }

  async function fetchHistory() {

  try {

    const response =
      await fetch(HISTORY_URL);

    const data =
      await response.json();

    setHistory(data.items);

  } catch (error) {

    console.error(error);

  }
}

  useEffect(() => {

    fetchData();

    fetchHistory();

    const interval = setInterval(() => {

      fetchData();

      fetchHistory();

    }, 5000);

    return () => clearInterval(interval);

  }, []);

  return (
    <Dashboard
      data={sensorData}
      history={history}
    />
  );
}

export default App;