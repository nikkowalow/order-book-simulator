import { useRef } from "react";
import { useWebSocket } from "../context/WebSocketContext";

export function MarketPrice() {
  const { book, trades } = useWebSocket();
  const prevMid = useRef<number | null>(null);

  const bestBid = book?.bids?.[0]?.price ?? null;
  const bestAsk = book?.asks?.[0]?.price ?? null;
  const mid =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const lastTrade = trades[0]?.price ?? null;

  const direction =
    mid !== null && prevMid.current !== null
      ? mid > prevMid.current
        ? "up"
        : mid < prevMid.current
          ? "down"
          : "flat"
      : "flat";

  if (mid !== null) prevMid.current = mid;

  const priceColor =
    direction === "up"
      ? "rgb(74, 222, 128)"
      : direction === "down"
        ? "rgb(248, 113, 113)"
        : "rgba(255,255,255,0.9)";

  if (mid === null) return null;

  return (
    <div style={{ textAlign: "center", lineHeight: 1.2 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: priceColor,
          letterSpacing: 0.5,
        }}
      >
        {mid % 1 === 0 ? mid.toFixed(0) : mid.toFixed(1)}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          display: "flex",
          gap: 10,
          justifyContent: "center",
        }}
      >
        <span>BID {bestBid}</span>
        <span>ASK {bestAsk}</span>
        {lastTrade !== null && <span>LAST {lastTrade}</span>}
      </div>
    </div>
  );
}
