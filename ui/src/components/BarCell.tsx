import { Side } from "../types/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function BarCell({
  side,
  value,
  max,
  children,
}: {
  side: Side;
  value: number;
  max: number;
  orders?: number[];
  children: React.ReactNode;
}) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  const bidGradient =
    "linear-gradient(90deg, rgba(0, 255, 94, 0.18) 0%, rgba(34,197,94,0.40) 100%)";
  const askGradient =
    "linear-gradient(270deg, rgba(255, 0, 0, 0.18) 0%, rgba(255, 0, 0, 0.4) 100%)";

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
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          transition: "width 180ms ease",
          ...(side === "bid"
            ? { right: 0, width: `${pct}%`, background: bidGradient }
            : { left: 0, width: `${pct}%`, background: askGradient }),
        }}
      />
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
