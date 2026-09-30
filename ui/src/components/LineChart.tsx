import { useEffect, useRef, useState } from "react";
import { T } from "../theme";

interface LineChartProps {
  data: number[];
  color?: string;
}

export default function LineChart({ data, color = T.cyan }: LineChartProps) {
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
  const pad = { top: 8, bottom: 6, left: 4, right: 34 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const max = data.length > 0 ? Math.max(...data) : 1;
  const yMax = Math.max(max * 1.2, 2);
  const n = data.length;

  const toX = (i: number) => pad.left + (n > 1 ? (i / (n - 1)) * pw : pw);
  const toY = (v: number) => pad.top + ph - (v / yMax) * ph;

  let linePath = "";
  if (n > 0) {
    linePath = `M${toX(0).toFixed(1)},${toY(data[0]).toFixed(1)}`;
    for (let i = 1; i < n; i++) {
      // horizontal, then vertical (step)
      linePath += ` L${toX(i).toFixed(1)},${toY(data[i - 1]).toFixed(1)}`;
      linePath += ` L${toX(i).toFixed(1)},${toY(data[i]).toFixed(1)}`;
    }
  }

  const areaPath = linePath
    ? linePath +
      ` L${toX(n - 1).toFixed(1)},${(pad.top + ph).toFixed(1)}` +
      ` L${toX(0).toFixed(1)},${(pad.top + ph).toFixed(1)} Z`
    : "";

  const yTicks = [0, yMax / 2, yMax].map((v) => ({
    y: toY(v),
    label: v.toFixed(1),
  }));

  const lastY = n > 0 ? toY(data[n - 1]) : 0;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    >
      {w > 0 && h > 0 && (
        <svg width={w} height={h} style={{ display: "block" }}>
          {yTicks.map(({ y, label }) => (
            <g key={label}>
              <line
                x1={pad.left}
                y1={y}
                x2={w - pad.right}
                y2={y}
                stroke={T.line}
                strokeDasharray="1 3"
              />
              <text
                x={w - pad.right + 4}
                y={y + 3}
                fontSize={9}
                fontFamily={T.font}
                fill={T.dim}
              >
                {label}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill={color} fillOpacity={0.1} />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={1.25}
              shapeRendering="crispEdges"
            />
          )}

          {n > 0 && (
            <>
              <line
                x1={pad.left}
                y1={lastY}
                x2={w - pad.right}
                y2={lastY}
                stroke={color}
                strokeOpacity={0.35}
                strokeDasharray="2 2"
              />
              <rect
                className="blink"
                x={toX(n - 1) - 2.5}
                y={lastY - 2.5}
                width={5}
                height={5}
                fill={color}
              />
            </>
          )}
        </svg>
      )}
    </div>
  );
}
