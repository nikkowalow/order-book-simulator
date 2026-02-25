import React, { useState, useRef } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import { useAnalyticsStore } from "../stores/analyticsStore";

type Toast = { msg: string; type: "success" | "error" } | null;

export default function OrderEntry() {
  const { send } = useWebSocket();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [cancelId, setCancelId] = useState("");
  const [orderLatencyMs, setOrderLatencyMs] = useState<number | null>(null);
  const [cancelLatencyMs, setCancelLatencyMs] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addLatency } = useAnalyticsStore.getState();

  const showToast = (msg: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const submitOrder = async (side: "BUY" | "SELL") => {
    const q = parseInt(qty, 10);
    if (!q || q <= 0) {
      showToast("Invalid quantity", "error");
      return;
    }

    if (orderType === "LIMIT") {
      const p = parseInt(price, 10);
      if (!p || p <= 0) {
        showToast("Invalid price", "error");
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
      const t2 = performance.now();
      setOrderLatencyMs(t2 - t1);
      addLatency(t2 - t1);

      if (data.error) {
        showToast(`Rejected: ${data.error}`, "error");
        return;
      }

      const filled = data.trades?.length ?? 0;
      showToast(
        filled > 0
          ? `${side} filled — ${filled} trade${filled !== 1 ? "s" : ""}`
          : `${side} order resting`,
        "success",
      );
    } catch (e: any) {
      showToast(e?.message ?? "Request failed", "error");
    }
  };

  const submitCancel = async () => {
    const id = parseInt(cancelId, 10);
    if (!id || id <= 0) {
      showToast("Invalid order ID", "error");
      return;
    }

    const t1 = performance.now();
    try {
      const { msg: data, rtt } = await send({ action: "cancel", id });
      setCancelLatencyMs(rtt);

      if (data.error) {
        showToast(`Rejected: ${data.error}`, "error");
        return;
      }
      showToast(
        data.ok ? "Order cancelled" : "Order not found",
        data.ok ? "success" : "error",
      );
    } catch (e: any) {
      showToast(e?.message ?? "Request failed", "error");
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: "0 10px",
    height: 30,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    fontSize: 13,
    width: 80,
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.9)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    marginBottom: 5,
    display: "block",
  };

  const btnBase: React.CSSProperties = {
    height: 30,
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.04em",
  };

  const isLimit = orderType === "LIMIT";
  const isMarket = orderType === "MARKET";

  return (
    <div
      className="panel"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: "0 16px",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Order type segmented control */}
        <div>
          <span style={labelStyle}>Type</span>
          <div
            style={{
              display: "flex",
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              height: 30,
            }}
          >
            <button
              onClick={() => setOrderType("LIMIT")}
              style={{
                ...btnBase,
                borderRadius: 0,
                padding: "0 13px",
                background: isLimit ? "rgba(59,130,246,0.22)" : "transparent",
                color: isLimit ? "rgb(147,197,253)" : "rgba(255,255,255,0.3)",
                borderRight: "1px solid rgba(255,255,255,0.1)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              LIMIT
            </button>
            <button
              onClick={() => setOrderType("MARKET")}
              style={{
                ...btnBase,
                borderRadius: 0,
                padding: "0 13px",
                background: isMarket ? "rgba(245,158,11,0.18)" : "transparent",
                color: isMarket ? "rgb(252,211,77)" : "rgba(255,255,255,0.3)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              MKT
            </button>
          </div>
        </div>

        {/* Price */}
        <div
          style={{
            opacity: isLimit ? 1 : 0.3,
            transition: "opacity 0.15s",
          }}
        >
          <span style={labelStyle}>Price</span>
          <input
            type="number"
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={!isLimit}
            style={{
              ...inputStyle,
              cursor: isLimit ? "text" : "not-allowed",
            }}
          />
        </div>

        {/* Qty */}
        <div>
          <span style={labelStyle}>Qty</span>
          <input
            type="number"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Buy / Sell */}
        <div style={{ display: "flex", gap: 6, alignSelf: "flex-end" }}>
          <button
            onClick={() => submitOrder("BUY")}
            style={{
              ...btnBase,
              padding: "0 22px",
              background: "rgb(22,163,74)",
              color: "white",
            }}
          >
            BUY
          </button>
          <button
            onClick={() => submitOrder("SELL")}
            style={{
              ...btnBase,
              padding: "0 20px",
              background: "rgb(220,38,38)",
              color: "white",
            }}
          >
            SELL
          </button>
        </div>

        {/* Cancel */}
        <div>
          <span style={labelStyle}>Order ID</span>
          <input
            type="number"
            placeholder="ID"
            value={cancelId}
            onChange={(e) => setCancelId(e.target.value)}
            style={{ ...inputStyle, width: 72 }}
          />
        </div>

        <button
          onClick={submitCancel}
          style={{
            ...btnBase,
            padding: "0 16px",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.1)",
            alignSelf: "flex-end",
          }}
        >
          CANCEL
        </button>

        {/* Latencies pushed to right */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 18,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
            Order{" "}
            <strong
              style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}
            >
              {orderLatencyMs == null ? "—" : `${orderLatencyMs.toFixed(1)} ms`}
            </strong>
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
            Cancel{" "}
            <strong
              style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}
            >
              {cancelLatencyMs == null
                ? "—"
                : `${cancelLatencyMs.toFixed(1)} ms`}
            </strong>
          </span>
        </div>
      </div>

      {/* Toast bar */}
      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: "0 0 14px 14px",
            padding: "7px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background:
              toast.type === "success"
                ? "rgba(22,163,74,0.9)"
                : "rgba(220,38,38,0.9)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "white" }}>
            {toast.msg}
          </span>
        </div>
      )}
    </div>
  );
}
