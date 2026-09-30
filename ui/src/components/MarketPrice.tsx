import { useWebSocket } from "../context/WebSocketContext";
import { useFlash } from "../hooks/useFlash";
import Flash from "./Flash";
import { T, fmt } from "../theme";

export function MarketPrice() {
  const { book } = useWebSocket();

  const bestBid = book?.bids?.[0]?.price ?? null;
  const bestAsk = book?.asks?.[0]?.price ?? null;
  const mid =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  // Arrow holds the direction of the last mid move.
  const move = useFlash(mid);
  const arrow = move?.dir === "up" ? "▲" : move?.dir === "down" ? "▼" : "■";
  const arrowColor =
    move?.dir === "up" ? T.up : move?.dir === "down" ? T.down : T.dim;

  if (mid === null || spread === null) return null;

  return (
    <div style={{ textAlign: "center", lineHeight: 1.15, padding: "2px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "center" }}>
        <span style={{ color: arrowColor, fontSize: 11 }}>{arrow}</span>
        <Flash
          value={mid}
          style={{ fontSize: 17, fontWeight: 700, color: T.text }}
        >
          {fmt(mid, 2)}
        </Flash>
      </div>
      <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.04em" }}>
        MID · SPRD{" "}
        <span style={{ color: T.yellow }}>{fmt(spread, 1)}</span> ·{" "}
        {((spread / mid) * 10_000).toFixed(0)} BPS
      </div>
    </div>
  );
}
