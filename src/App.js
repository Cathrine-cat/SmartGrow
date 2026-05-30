import { useEffect, useState } from "react";

import Dashboard from "./components/Dashboard";

function App() {

  const [sensorData, setSensorData] = useState(null);

  const [history, setHistory] = useState([]);

  const [settings, setSettings] =useState({autoMode: false,minIntervalHours: 24, wateringDuration: 10});

  const BASE_URL =
  "https://n6pf7o109j.execute-api.eu-north-1.amazonaws.com";

  const API_URL =
    `${BASE_URL}/latest-data`;

  const HISTORY_URL =
    `${BASE_URL}/history`;

  const CONTROL_URL =
    `${BASE_URL}/control`;

  const SETTINGS_URL =
    `${BASE_URL}/settings`;  
  

  async function fetchData() {

    try {
      const response =  await fetch(API_URL);
      const data = await response.json();
      console.log("LATEST:", data);
      setSensorData(data);
    } catch (error) {
      console.error("Latest data error:",error );
    }
  }

  async function fetchHistory() {
  try {
    const response = await fetch(HISTORY_URL);
    const data = await response.json();
    setHistory(data);
    console.log("HISTORY RESPONSE:", data);
  } catch (error) {
    console.error(error);
  }
}

async function fetchSettings() {
  try {
    const response =await fetch(SETTINGS_URL);
    const data =await response.json();
    console.log("SETTINGS:",data);
    setSettings(data);
  } catch (error) {
    console.error(
      "Settings error:",
      error
    );
  }
}

  useEffect(() => {
  const load = async () => {
    await fetchData();
    await fetchHistory();
    await fetchSettings();
  };
  load();
  const interval = setInterval(() => {
    fetchData();
    fetchHistory();
  }, 5000);
  return () => clearInterval(interval);
}, []);


async function activatePump() {
  try {

    const response = await fetch(
      CONTROL_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          command: "ON"
        })
      }
    );

    const result =
      await response.json();
    console.log(result);
    alert("Pump activated");
  } catch (error) {
    console.error(error);
    alert("Error activating pump");
  }
}

async function saveSettings() {
  try {
    const response =await fetch(SETTINGS_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(
            settings
          )
        }
      );
    const result = await response.json();
    console.log(result);
    alert(
      "Settings saved"
    );
  } catch (error) {
    console.error(error);
    alert(
      "Error saving settings"
    );
  }
}

  return (
    <Dashboard
     data={sensorData}
  history={history}
  activatePump={activatePump}
  settings={settings}

  setSettings={setSettings}

  saveSettings={
    saveSettings}
    />
  );
}

export default App;