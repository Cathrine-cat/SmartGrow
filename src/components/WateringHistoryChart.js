import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function WateringHistoryChart({ history }) {

  // Convert backend data into time-series format
  const chartData = [...history]
  .reverse()
  .map(item => ({
    time: new Date(item.timestamp).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }),
    duration: item.duration
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis
          dataKey="time"
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          height={60}
        />

        <YAxis
          label={{
            value: "Pump (sec)",
            angle: -90,
            position: "insideLeft"
          }}
        />

        <Tooltip />

        <Line
          type="monotone"
          dataKey="duration"
          stroke="#2e7d32"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default WateringHistoryChart;