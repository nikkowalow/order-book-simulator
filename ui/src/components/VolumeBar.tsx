import { T, fmt } from "../theme";

const SEGMENTS = 48;

// Bid/ask resting-volume split as an LED meter.
export function VolumeBar({
  bidVolume,
  askVolume,
}: {
  bidVolume: number;
  askVolume: number;
}) {
  const total = bidVolume + askVolume;
  const bidPct = total > 0 ? (bidVolume / total) * 100 : 50;
  const askPct = 100 - bidPct;
  const lit = Math.round((bidPct / 100) * SEGMENTS);

  return (
    <div
      style={{
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 8,
        padding: "4px 6px",
        borderTop: `1px solid ${T.line}`,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      <span style={{ color: T.up }}>
        BID {fmt(bidVolume)} · {bidPct.toFixed(1)}%
      </span>
      <div style={{ display: "flex", gap: 2, height: 8 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i < lit ? T.up : T.down,
              opacity: i === lit - 1 || i === lit ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <span style={{ color: T.down }}>
        {askPct.toFixed(1)}% · {fmt(askVolume)} ASK
      </span>
    </div>
  );
}
