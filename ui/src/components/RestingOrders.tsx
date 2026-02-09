import { useState } from "react";
import { SERVER_URL } from "../config/config";
import { useOrders } from "../hooks/useOrders";
import { useUser } from "../context/UserContext";
import { Side } from "../types/types";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getSideStyle(side: Side): React.CSSProperties {
  return side === "bid"
    ? { color: "rgb(34, 197, 94)" } // green
    : { color: "rgb(239, 68, 68)" }; // red
}

async function cancelOrder(id: number, userId: number | null) {
  await fetch(`${SERVER_URL}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, user_id: userId }),
  });
}

export default function RestingOrders() {
  const { orders, err } = useOrders();
  const { userId } = useUser();
  const [showMine, setShowMine] = useState(false);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", color: "crimson" }}>
        Error fetching orders: {err}
      </div>
    );
  }

  if (!orders) return <div style={{ maxWidth: 900 }}>Loading...</div>;

  const filtered = showMine
    ? orders.filter((o) => o.user_id === userId)
    : orders;

  const bids = filtered.filter((o) => o.side === "bid");
  const asks = filtered.filter((o) => o.side === "ask");

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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Resting Orders</span>
        <div
          style={{
            display: "flex",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {(["All", "Mine"] as const).map((label) => {
            const active =
              (label === "Mine" && showMine) ||
              (label === "All" && !showMine);
            return (
              <button
                key={label}
                onClick={() => setShowMine(label === "Mine")}
                style={{
                  background: active
                    ? "rgba(255,255,255,0.15)"
                    : "transparent",
                  color: active
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.4)",
                  border: "none",
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 0.5fr",
          padding: "8px 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>ID</span>
        <span style={{ textAlign: "center" }}>Side</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Qty</span>
        <span></span>
      </div>

      {/* Rows */}
      <div>
        {filtered.length === 0 && (
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {showMine ? "No orders for your session" : "No resting orders"}
          </div>
        )}
        {filtered.map((o) => (
          <div
            key={o.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 0.5fr",
              padding: "6px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              fontFamily: "monospace",
              alignItems: "center",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)" }}>{o.id}</span>

            <span
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                ...getSideStyle(o.side),
              }}
            >
              {o.side.toUpperCase()}
            </span>

            <span
              style={{
                textAlign: "right",
                fontWeight: 650,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {fmt(o.price, 1)}
            </span>

            <span
              style={{
                textAlign: "right",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {fmt(o.qty)}
            </span>

            <button
              onClick={() => cancelOrder(o.id, userId)}
              style={{
                background: "transparent",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                color: "rgb(239, 68, 68)",
                borderRadius: 3,
                padding: "2px 6px",
                fontSize: 10,
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              X
            </button>
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
        {bids.length} bids, {asks.length} asks
      </div>
    </div>
  );
}
