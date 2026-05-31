import { useEffect, useState } from "react";

import Dashboard from "./components/Dashboard";

function App() {

  const [sensorData, setSensorData] = useState(null);

  const [history, setHistory] = useState([]);

  const [settings, setSettings] =useState({autoMode: false,minIntervalHours: 24, wateringDuration: 10, thresholdMoisture: 30});

  const [wateringHistory,setWateringHistory] = useState([]);
  const [manualDuration, setManualDuration] =useState("");

  const [pumpStatus,setPumpStatus] = useState(null);

  const [remaining,setRemaining] =useState(0);

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

  const PUMP_STATUS_URL =
 `${BASE_URL}/pumpStatus`;

 const WATERING_HISTORY_URL =
  `${BASE_URL}/watering-history`;

 const PUMP_TIMEOUT_SECONDS = 60;
  

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

async function fetchWateringHistory() {
  try {
    const response =
      await fetch(WATERING_HISTORY_URL);

    const data =
      await response.json();

    setWateringHistory(data);

  } catch (error) {
    console.error(error);
  }
}

async function fetchPumpStatus() {
  try {
    const response =
      await fetch(
        PUMP_STATUS_URL
      );
    const data =
      await response.json();
    setPumpStatus(data);
  } catch(error) {
    console.error(error);
  }
}

  useEffect(() => {
  const load = async () => {
    await fetchData();
    await fetchHistory();
    await fetchSettings();
    await fetchPumpStatus();
    await fetchWateringHistory();
  };
  load();
  const interval = setInterval(() => {
    fetchData();
    fetchHistory();
    fetchPumpStatus();
    fetchWateringHistory();
  }, 5000);
  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (!pumpStatus) return;

  const interval = setInterval(() => {
    if (pumpStatus.status !== "ON" || !pumpStatus.startTime) {
      setRemaining(0);
      return;
    }

    const start = new Date(pumpStatus.startTime);
    const elapsed = (Date.now() - start.getTime()) / 1000;

    const left = Math.max(
      0,
      Math.round(pumpStatus.duration - elapsed)
    );

    setRemaining(left);
  }, 1000);

  return () => clearInterval(interval);
}, [pumpStatus]);


async function activatePump() {

  const duration =
    manualDuration === ""
      ? settings?.wateringDuration || 10
      : Number(manualDuration);

  try {

    const response = await fetch(
      CONTROL_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          command: "ON",
          duration: duration,
          source: "manual"
        })
      }
    );

  const result =
      await response.json();
    console.log(result);
    alert("Command sent");
  } catch (error) {
    console.error(error);
    alert("Error sending command");
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

function getSafePumpStatus() {
  if (!pumpStatus) return null;

  const lastUpdate =
    pumpStatus.startTime ||
    pumpStatus.timestamp;

  if (!lastUpdate) return pumpStatus;

  const ageSeconds =
    (Date.now() - new Date(lastUpdate).getTime()) / 1000;

  const isStale = ageSeconds > PUMP_TIMEOUT_SECONDS;

  return {
    ...pumpStatus,
    isActuallyOn:
      pumpStatus.status === "ON" && !isStale,
  };
}

const safePumpStatus = getSafePumpStatus();

  return (
    <Dashboard
     data={sensorData}
  history={history}
  activatePump={activatePump}
  settings={settings}
  wateringHistory={wateringHistory}

  setSettings={setSettings}

   saveSettings={
    saveSettings}
    manualDuration={manualDuration}
    setManualDuration={setManualDuration}

    pumpStatus={safePumpStatus}
     remaining={remaining}
    />
  );
}

export default App;