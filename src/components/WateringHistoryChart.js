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
  const sortedHistory = [...history].sort(
  (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
);

if (sortedHistory.length === 0) {
  return <p>No watering history available.</p>;
}

// Round the start time down to the nearest hour
const start = new Date(sortedHistory[0].timestamp);
start.setMinutes(0, 0, 0);

// Round the end time up to the nearest hour
const end = new Date();
end.setMinutes(0, 0, 0);
end.setHours(end.getHours() + 1);

// Create hourly buckets
const buckets = [];

for (
  let time = new Date(start);
  time <= end;
  time.setHours(time.getHours() + 1)
) {
  buckets.push({
    timestamp: new Date(time),
    duration: 0,
  });
}

// Add watering durations to the correct hour
sortedHistory.forEach((event) => {
  const eventTime = new Date(event.timestamp);

  const bucketIndex = Math.floor(
    (eventTime - start) / (1000 * 60 * 60)
  );

  if (bucketIndex >= 0 && bucketIndex < buckets.length) {
    buckets[bucketIndex].duration += Number(event.duration) || 0;
  }
});

// Format for Recharts
const chartData = buckets.map((bucket) => ({
  time: bucket.timestamp.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }),
  duration: bucket.duration,
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
        domain={[0, 100]}
        allowDataOverflow={true}
          label={{
            value: "Pump (sec)",
            angle: -90,
            position: "insideLeft"
          }}
        />

        <Tooltip />

        <Line
          type="linear"
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