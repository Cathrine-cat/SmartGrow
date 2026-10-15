import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const MAX_CHART_POINTS = 300;

function SoilChart({ history }) {
  const points = useMemo(() => {
    const rows = Array.isArray(history) ? history : [];
    return rows
      .filter((item) => item?.timestamp
        && Number.isFinite(new Date(item.timestamp).getTime())
        && item.soil !== null
        && item.soil !== undefined
        && Number.isFinite(Number(item.soil)))
      .slice(-MAX_CHART_POINTS);
  }, [history]);

  const chartData = useMemo(() => ({
    labels: points.map((item) => new Date(item.timestamp).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })),
    datasets: [{
      label: "Soil moisture",
      data: points.map((item) => Number(item.soil)),
      borderColor: "#238456",
      backgroundColor: "rgba(58, 161, 102, 0.14)",
      borderWidth: 2.5,
      fill: true,
      tension: 0.28,
      pointRadius: 0,
      pointHoverRadius: 5,
    }],
  }), [points]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Soil moisture: ${context.parsed.y}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 6, maxRotation: 0, color: "#697a6d" },
        border: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20, color: "#697a6d", callback: (value) => `${value}%` },
        grid: { color: "rgba(18, 62, 43, 0.08)" },
        border: { display: false },
      },
    },
  }), []);

  if (points.length === 0) return <p>No soil moisture history available.</p>;

  return <div className="soil-chart"><Line data={chartData} options={options} /></div>;
}

export default SoilChart;
