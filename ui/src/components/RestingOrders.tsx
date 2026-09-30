import { useState } from "react";
import { SERVER_URL } from "../config/config";
import { useWebSocket } from "../context/WebSocketContext";
import Panel from "./Panel";
import Flash from "./Flash";
import { T, fmt } from "../theme";

const COLS = "10px 1.2fr 0.7fr 1fr 0.8fr 28px";

async function cancelOrder(id: number, userId: number | null) {
  await fetch(`${SERVER_URL}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, user_id: userId }),
  });
}

export default function RestingOrders() {
  const { orders, userId } = useWebSocket();
  const [showMine, setShowMine] = useState(false);

  const all = orders ?? [];
  const mineCount = all.filter((o) => o.user_id === userId).length;
  const filtered = showMine ? all.filter((o) => o.user_id === userId) : all;
  const bids = filtered.filter((o) => o.side === "bid");
  const asks = filtered.filter((o) => o.side === "ask");

  return (
    <Panel
      code="RO"
      title="Resting Orders"
      meta={
        <span style={{ display: "flex", gap: 3 }}>
          {(["All", "Mine"] as const).map((label, i) => {
            const active = (label === "Mine") === showMine;
            return (
              <button
                key={label}
                onClick={() => setShowMine(label === "Mine")}
                className={active ? "t-btn on" : "t-btn"}
                style={{ fontSize: 10, padding: "0 5px" }}
              >
                {i + 1}) {label}
              </button>
            );
          })}
        </span>
      }
      bodyStyle={{ overflow: "hidden" }}
    >
      <div
        className="t-cols"
        style={{ display: "grid", gridTemplateColumns: COLS, padding: "2px 6px" }}
      >
        <span />
        <span>Ord ID</span>
        <span>Side</span>
        <span style={{ textAlign: "right" }}>Px</span>
        <span style={{ textAlign: "right" }}>Qty</span>
        <span />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {!orders && (
          <div className="blink" style={{ padding: 8, color: T.amber }}>
            LOADING ORDERS…
          </div>
        )}
        {orders && filtered.length === 0 && (
          <div style={{ padding: "12px 6px", color: T.mute, textAlign: "center" }}>
            {showMine ? "NO ORDERS FOR THIS SESSION" : "NO RESTING ORDERS"}
          </div>
        )}
        {filtered.map((o) => {
          const mine = o.user_id === userId;
          return (
            <div
              key={o.id}
              className="flash-new"
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                alignItems: "center",
                padding: "1px 6px",
                fontSize: 11,
                borderBottom: `1px solid ${T.lineSoft}`,
                background: mine ? "rgba(255,210,63,0.06)" : undefined,
              }}
            >
              <span style={{ color: T.yellow }}>{mine ? "►" : ""}</span>
              <span style={{ color: mine ? T.yellow : T.dim }}>{o.id}</span>
              <span
                style={{ fontWeight: 700, color: o.side === "bid" ? T.up : T.down }}
              >
                {o.side === "bid" ? "BID" : "ASK"}
              </span>
              <span style={{ textAlign: "right", fontWeight: 600, color: T.text }}>
                {fmt(o.price, 1)}
              </span>
              <span style={{ textAlign: "right" }}>
                <Flash value={o.qty} style={{ color: T.text }}>
                  {fmt(o.qty)}
                </Flash>
              </span>
              <button
                onClick={() => cancelOrder(o.id, userId)}
                title="Cancel order"
                style={{
                  marginLeft: "auto",
                  padding: 0,
                  font: "inherit",
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.down,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                [X]
              </button>
            </div>
          );
        })}
      </div>

      <div className="t-foot">
        <span>
          <span style={{ color: T.up }}>{bids.length} BID</span> ·{" "}
          <span style={{ color: T.down }}>{asks.length} ASK</span>
        </span>
        <span style={{ color: mineCount ? T.yellow : undefined }}>MINE {mineCount}</span>
      </div>
    </Panel>
  );
}
