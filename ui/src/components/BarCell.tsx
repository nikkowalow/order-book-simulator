import { useState } from "react";
import { Side } from "../types/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Generate alternating shades for segments
function getSegmentColor(side: Side, index: number): string {
  if (side === "bid") {
    // Alternating green shades
    const shades = [
      "rgba(34, 197, 94, 0.35)",
      "rgba(22, 163, 74, 0.45)",
      "rgba(34, 197, 94, 0.28)",
      "rgba(22, 163, 74, 0.38)",
    ];
    return shades[index % shades.length];
  } else {
    // Alternating red shades
    const shades = [
      "rgba(239, 68, 68, 0.35)",
      "rgba(220, 38, 38, 0.45)",
      "rgba(239, 68, 68, 0.28)",
      "rgba(220, 38, 38, 0.38)",
    ];
    return shades[index % shades.length];
  }
}

export function BarCell({
  side,
  value,
  max,
  orders,
  children,
}: {
  side: Side;
  value: number;
  max: number;
  orders?: number[];
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  const bidGradient =
    "linear-gradient(90deg, rgba(0, 255, 94, 0.18) 0%, rgba(34,197,94,0.40) 100%)";
  const askGradient =
    "linear-gradient(270deg, rgba(255, 0, 0, 0.18) 0%, rgba(255, 0, 0, 0.4) 100%)";

  // Compute segment positions as percentages of the bar width
  const segments =
    orders && orders.length > 0 && value > 0
      ? orders.map((qty) => (qty / value) * 100)
      : null;

  const hasMultipleOrders = segments && segments.length > 1;

  return (
    <div
      style={{
        position: "relative",
        height: 28,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main bar - use segments if multiple orders, otherwise gradient */}
      {hasMultipleOrders ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: side === "bid" ? "row" : "row-reverse",
            transition: "width 180ms ease",
            ...(side === "bid"
              ? { left: 0, width: `${pct}%` }
              : { right: 0, width: `${pct}%` }),
          }}
        >
          {segments.map((segPct, i) => (
            <div
              key={i}
              style={{
                width: `${segPct}%`,
                height: "100%",
                background: getSegmentColor(side, i),
                borderRight:
                  hovered && i < segments.length - 1
                    ? "1px solid rgba(255,255,255,0.7)"
                    : "none",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            transition: "width 180ms ease",
            ...(side === "bid"
              ? { left: 0, width: `${pct}%`, background: bidGradient }
              : { right: 0, width: `${pct}%`, background: askGradient }),
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
    </div>
  );
}
