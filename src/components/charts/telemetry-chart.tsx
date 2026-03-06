"use client";

import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CarData } from "@/lib/openf1/types";

interface TelemetryChartProps {
  data: CarData[];
}

export function TelemetryChart({ data }: TelemetryChartProps) {
  // Downsample using simple decimation
  const maxPoints = 800;
  const step = Math.max(1, Math.floor(data.length / maxPoints));
  const sampled = data.filter((_, i) => i % step === 0).map((d, i) => ({
    idx: i,
    speed: d.speed,
    throttle: d.throttle,
    brake: d.brake,
    gear: d.n_gear,
    rpm: d.rpm,
  }));

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "#1E1E2E",
      border: "1px solid #2E2E42",
      borderRadius: 8,
      fontSize: 11,
    },
  };

  return (
    <div className="space-y-4">
      {/* Speed */}
      <div>
        <p className="mb-1 text-xs font-semibold text-f1-text-muted uppercase">
          Speed (km/h)
        </p>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={sampled} syncId="telemetry">
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
            <XAxis dataKey="idx" hide />
            <YAxis stroke="#6B6B7B" tick={{ fontSize: 10 }} width={50} />
            <Tooltip {...tooltipStyle} />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#00D2BE"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Throttle */}
      <div>
        <p className="mb-1 text-xs font-semibold text-f1-text-muted uppercase">
          Throttle (%)
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={sampled} syncId="telemetry">
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
            <XAxis dataKey="idx" hide />
            <YAxis
              stroke="#6B6B7B"
              tick={{ fontSize: 10 }}
              domain={[0, 100]}
              width={50}
            />
            <Tooltip {...tooltipStyle} />
            <Area
              type="monotone"
              dataKey="throttle"
              stroke="#43B02A"
              fill="#43B02A"
              fillOpacity={0.2}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Brake */}
      <div>
        <p className="mb-1 text-xs font-semibold text-f1-text-muted uppercase">
          Brake
        </p>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={sampled} syncId="telemetry">
            <XAxis dataKey="idx" hide />
            <YAxis hide domain={[0, 100]} />
            <Area
              type="stepAfter"
              dataKey="brake"
              stroke="#E10600"
              fill="#E10600"
              fillOpacity={0.4}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gear */}
      <div>
        <p className="mb-1 text-xs font-semibold text-f1-text-muted uppercase">
          Gear
        </p>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={sampled} syncId="telemetry">
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" />
            <XAxis dataKey="idx" hide />
            <YAxis
              stroke="#6B6B7B"
              tick={{ fontSize: 10 }}
              domain={[0, 8]}
              width={50}
            />
            <Tooltip {...tooltipStyle} />
            <Line
              type="stepAfter"
              dataKey="gear"
              stroke="#FFC906"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
