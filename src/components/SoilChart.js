import {

  Chart as ChartJS,

  CategoryScale,

  LinearScale,

  PointElement,

  LineElement,

  Title,

  Tooltip,

  Legend

} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function SoilChart({ history }) {

  if (!history || history.length === 0) {
    return <p>No chart data</p>;
  }

  const soilMap = {
  dry: 0,
  moist: 50,
  wet: 100
  };

  const chartData = {
  labels: history.map(item =>
    new Date(item.timestamp).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  ),

  datasets: [
    {
      label: "Soil Moisture",
      data: history.map(
        item => item.soil
      ),
      borderColor: "green",
      tension: 0.3
    }
  ]
};

  return <Line data={chartData} />;
}

export default SoilChart;