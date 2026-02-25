import { useEffect, useRef, useState } from "react";

interface LineChartProps {
  data: number[];
  color?: string;
}

export default function LineChart({
  data,
  color = "rgb(74,222,128)",
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { w, h } = dims;
  const pad = { top: 8, bottom: 20, left: 4, right: 4 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const max = data.length > 0 ? Math.max(...data) : 1;
  const yMax = Math.max(max * 1.2, 2);
  const n = data.length;

  const toX = (i: number) => pad.left + (i / (n - 1)) * pw;
  const toY = (v: number) => pad.top + ph - (v / yMax) * ph;

  const linePath =
    n > 0
      ? (() => {
          let path = `M${toX(0).toFixed(1)},${toY(data[0]).toFixed(1)}`;

          for (let i = 1; i < n; i++) {
            const prevY = toY(data[i - 1]);
            const currX = toX(i);
            const currY = toY(data[i]);

            // horizontal segment
            path += ` L${currX.toFixed(1)},${prevY.toFixed(1)}`;

            // vertical segment
            path += ` L${currX.toFixed(1)},${currY.toFixed(1)}`;
          }

          return path;
        })()
      : "";

  const areaPath =
    linePath.length > 0
      ? linePath +
        ` L${toX(n - 1).toFixed(1)},${(pad.top + ph).toFixed(1)}` +
        ` L${toX(0).toFixed(1)},${(pad.top + ph).toFixed(1)} Z`
      : "";

  const yTicks = [0, yMax / 2, yMax].map((v) => ({
    y: toY(v),
    label: v.toFixed(1),
  }));

  const gradId = `area-grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    >
      {w > 0 && h > 0 && (
        <svg width={w} height={h} style={{ display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {yTicks.map(({ y, label }) => (
            <g key={label}>
              <line
                x1={pad.left}
                y1={y}
                x2={w - pad.right}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
              <text
                x={w - pad.right - 2}
                y={y - 3}
                fontSize={8}
                fill="rgba(255,255,255,0.2)"
                textAnchor="end"
              >
                {label}
              </text>
            </g>
          ))}

          <line
            x1={pad.left}
            y1={pad.top + ph}
            x2={w - pad.right}
            y2={pad.top + ph}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />

          {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {n > 0 && (
            <circle
              cx={toX(n - 1)}
              cy={toY(data[n - 1])}
              r={2.5}
              fill={color}
            />
          )}
        </svg>
      )}
    </div>
  );
}
