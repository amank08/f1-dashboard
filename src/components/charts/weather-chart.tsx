"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Weather } from "@/lib/openf1/types";
import { format, parseISO } from "date-fns";

interface WeatherChartProps {
  weather: Weather[];
}

export function WeatherChart({ weather }: WeatherChartProps) {
  // Downsample if too many points
  const step = Math.max(1, Math.floor(weather.length / 200));
  const data = weather
    .filter((_, i) => i % step === 0)
    .map((w) => ({
      time: format(parseISO(w.date), "HH:mm"),
      airTemp: w.air_temperature,
      trackTemp: w.track_temperature,
      humidity: w.humidity,
      windSpeed: w.wind_speed,
      rainfall: w.rainfall,
    }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
        <XAxis dataKey="time" stroke="#6B6B7B" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="temp"
          stroke="#6B6B7B"
          tick={{ fontSize: 11 }}
          label={{
            value: "Temperature (°C)",
            angle: -90,
            position: "insideLeft",
            fill: "#A0A0B0",
            style: { fontSize: 11 },
          }}
        />
        <YAxis
          yAxisId="humidity"
          orientation="right"
          stroke="#6B6B7B"
          tick={{ fontSize: 11 }}
          domain={[0, 100]}
          label={{
            value: "Humidity (%)",
            angle: 90,
            position: "insideRight",
            fill: "#A0A0B0",
            style: { fontSize: 11 },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1E1E2E",
            border: "1px solid #2E2E42",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="airTemp"
          name="Air Temp"
          stroke="#E10600"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="trackTemp"
          name="Track Temp"
          stroke="#FFC906"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="humidity"
          type="monotone"
          dataKey="humidity"
          name="Humidity"
          stroke="#0067FF"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
