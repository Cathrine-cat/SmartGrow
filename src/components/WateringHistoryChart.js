import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function WateringHistoryChart({ history }) {
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 6);

    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + index);
      return {
        date: day,
        dayKey: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
        label: day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
        duration: 0,
        events: 0,
      };
    });
    const byDay = new Map(days.map((day) => [day.dayKey, day]));
    const rows = Array.isArray(history) ? history.slice(-500) : [];

    rows.forEach((event) => {
      const eventDate = new Date(event?.timestamp);
      if (!Number.isFinite(eventDate.getTime())) return;
      eventDate.setHours(0, 0, 0, 0);
      const key = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`;
      const bucket = byDay.get(key);
      if (!bucket) return;
      bucket.duration += Math.max(0, Number(event.duration) || 0);
      bucket.events += 1;
    });

    return days;
  }, [history]);

  const hasWatering = chartData.some((day) => day.events > 0);
  if (!hasWatering) return <p>No watering events in the last 7 days.</p>;

  return (
    <div className="watering-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(18, 62, 43, 0.09)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#697a6d", fontSize: 12 }} />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#697a6d", fontSize: 12 }}
            label={{ value: "Seconds", angle: -90, position: "insideLeft", fill: "#697a6d" }}
          />
          <Tooltip
            formatter={(value) => [`${Math.round(value)} sec`, "Watering"]}
            labelFormatter={(label) => label}
            contentStyle={{ borderRadius: 10, borderColor: "#e7efe8" }}
          />
          <Bar dataKey="duration" name="Watering" fill="#3aa166" radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WateringHistoryChart;
