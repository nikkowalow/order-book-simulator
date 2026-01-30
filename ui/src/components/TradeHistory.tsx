import { useMemo } from "react";
import { useTrades } from "../hooks/useTrades";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDateTime(ts: number) {
  const d = new Date(ts / 1_000_000); // ns → ms (already fixed)

  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return `${date} ${time}`;
}

export default function TradeHistory() {
  const { trades, err } = useTrades(100);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", color: "crimson" }}>
        Error fetching trades: {err}
      </div>
    );
  }

  if (!trades) return <div style={{ maxWidth: 900 }}>Loading…</div>;

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          fontWeight: 700,
          letterSpacing: 0.3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        Trade History
      </div>

      {/* Column labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          padding: "8px 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>Time (UTC)</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
      </div>

      {/* Rows */}
      <div>
        {trades.map((t) => (
          <div
            key={t.seq}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              padding: "6px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              fontFamily: "monospace",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)" }}>
              {fmtDateTime(t.ts)}
            </span>

            <span
              style={{
                textAlign: "right",
                fontWeight: 650,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {fmt(t.price, 1)}
            </span>

            <span
              style={{
                textAlign: "right",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {fmt(t.qty)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        Showing last {trades.length} trades
      </div>
    </div>
  );
}
