import React, { useState, useRef } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import { useAnalyticsStore } from "../stores/analyticsStore";
import BalanceStrip from "./BalanceStrip";
import Panel from "./Panel";
import { T, fmt } from "../theme";

type Status = { msg: string; type: "success" | "error"; n: number } | null;

export default function OrderEntry() {
  const { send } = useWebSocket();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [status, setStatus] = useState<Status>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addLatency } = useAnalyticsStore.getState();

  const showStatus = (msg: string, type: "success" | "error") => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus((s) => ({ msg, type, n: (s?.n ?? 0) + 1 }));
    statusTimer.current = setTimeout(() => setStatus(null), 5000);
  };

  const submitOrder = async (side: "BUY" | "SELL") => {
    const q = parseInt(qty, 10);
    if (!q || q <= 0) {
      showStatus("INVALID QUANTITY", "error");
      return;
    }

    if (orderType === "LIMIT") {
      const p = parseInt(price, 10);
      if (!p || p <= 0) {
        showStatus("INVALID PRICE", "error");
        return;
      }
    }

    const msg: Record<string, unknown> = {
      action: "order",
      side,
      qty: q,
      type: orderType,
    };
    if (orderType === "LIMIT") msg.price = parseInt(price, 10);

    const t1 = performance.now();
    try {
      const { msg: data } = await send(msg);
      const rtt = performance.now() - t1;
      addLatency(rtt);

      if (data.error) {
        showStatus(`REJECTED: ${String(data.error).toUpperCase()}`, "error");
        return;
      }

      const filled = data.trades?.length ?? 0;
      showStatus(
        `${side} ${filled > 0 ? `FILLED · ${filled} TRADE${filled !== 1 ? "S" : ""}` : "RESTING"} · RTT ${rtt.toFixed(2)}MS`,
        "success",
      );
    } catch (e: any) {
      showStatus(String(e?.message ?? "Request failed").toUpperCase(), "error");
    }
  };

  const isLimit = orderType === "LIMIT";
  const p = parseInt(price, 10);
  const q = parseInt(qty, 10);
  const notional = isLimit && p > 0 && q > 0 ? p * q : null;

  const sideButton = (side: "BUY" | "SELL"): React.CSSProperties => ({
    flex: 1,
    height: 36,
    font: "inherit",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.12em",
    cursor: "pointer",
    color: "#000",
    background: side === "BUY" ? T.up : T.down,
    border: "1px solid",
    borderColor:
      side === "BUY"
        ? "#8bffa8 #0c7a28 #0c7a28 #8bffa8"
        : "#ff9a9a #8a1414 #8a1414 #ff9a9a",
  });

  return (
    <Panel
      code="TK"
      title="Order Ticket"
      meta={
        <span style={{ display: "flex", gap: 3 }}>
          {(["LIMIT", "MARKET"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={orderType === t ? "t-btn on" : "t-btn"}
              style={{ fontSize: 13, padding: "0 5px" }}
            >
              {t === "LIMIT" ? "LMT" : "MKT"}
            </button>
          ))}
        </span>
      }
      bodyStyle={{ overflow: "hidden" }}
    >
      <BalanceStrip />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 6px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <label style={{ opacity: isLimit ? 1 : 0.4 }}>
            <span className="t-label" style={{ display: "block", marginBottom: 2 }}>
              Limit Px
            </span>
            <input
              type="number"
              className="t-input"
              placeholder={isLimit ? "0" : "MKT"}
              value={isLimit ? price : ""}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!isLimit}
            />
          </label>
          <label>
            <span className="t-label" style={{ display: "block", marginBottom: 2 }}>
              Qty
            </span>
            <input
              type="number"
              className="t-input"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: T.dim,
          }}
        >
          <span>
            <span style={{ color: T.amber }}>ORDER</span>{" "}
            <span style={{ color: T.text }}>
              {q > 0 ? fmt(q) : "—"} @ {isLimit ? (p > 0 ? fmt(p, 1) : "—") : "MKT"}
            </span>
          </span>
          <span>
            <span style={{ color: T.amber }}>NOTIONAL</span>{" "}
            <span style={{ color: T.text }}>
              {notional != null ? `$${fmt(notional)}` : isLimit ? "—" : "@ BEST"}
            </span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => submitOrder("BUY")} style={sideButton("BUY")}>
            BUY
          </button>
          <button onClick={() => submitOrder("SELL")} style={sideButton("SELL")}>
            SELL
          </button>
        </div>
      </div>

      {/* Message line */}
      <div
        style={{
          padding: "2px 6px",
          borderTop: `1px solid ${T.line}`,
          background: "#0a0a0a",
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ color: T.amber }}>MSG&gt; </span>
        {status ? (
          <span
            key={status.n}
            className={status.type === "success" ? "fx flash-up" : "fx flash-down"}
            style={{ color: status.type === "success" ? T.up : T.down }}
          >
            {status.msg}
          </span>
        ) : (
          <span className="cursor" style={{ color: T.dim }}>
            READY{" "}
          </span>
        )}
      </div>
    </Panel>
  );
}
