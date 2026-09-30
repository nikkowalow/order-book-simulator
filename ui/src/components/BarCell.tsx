import { ReactNode } from "react";
import { Side } from "../types/types";

export const ROW_HEIGHT = 18;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// LED-segment depth bars
const BID_BAR =
  "repeating-linear-gradient(90deg, rgba(32,224,80,0.30) 0 3px, rgba(32,224,80,0.08) 3px 4px)";
const ASK_BAR =
  "repeating-linear-gradient(90deg, rgba(255,61,61,0.30) 0 3px, rgba(255,61,61,0.08) 3px 4px)";

export function BarCell({
  side,
  value,
  max,
  columns,
  highlight,
  children,
}: {
  side: Side;
  value: number;
  max: number;
  columns: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  return (
    <div
      style={{
        position: "relative",
        height: ROW_HEIGHT,
        overflow: "hidden",
        background: highlight ? "rgba(255,158,27,0.07)" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          width: `${pct}%`,
          transition: "width 180ms steps(3, end)",
          ...(side === "bid"
            ? { right: 0, background: BID_BAR }
            : { left: 0, background: ASK_BAR }),
        }}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "grid",
          gridTemplateColumns: columns,
          alignItems: "center",
          padding: "0 6px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
