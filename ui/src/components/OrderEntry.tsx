import React, { useState, useRef } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import { useAnalyticsStore } from "../stores/analyticsStore";
import BalanceStrip from "./BalanceStrip";

type Toast = { msg: string; type: "success" | "error" } | null;

export default function OrderEntry() {
  const { send } = useWebSocket();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
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
      addLatency(performance.now() - t1);

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

  const isLimit = orderType === "LIMIT";
  const isMarket = orderType === "MARKET";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 36,
    padding: "0 10px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    fontSize: 13,
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

  return (
    <div
      className="panel"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <BalanceStrip />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "10px 14px",
          gap: 8,
        }}
      >
        {/* Row 1: Type (left half) + Price & Qty (right half) */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* Type toggle — left 50% */}
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Type</span>
            <div
              style={{
                display: "flex",
                height: 36,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <button
                onClick={() => setOrderType("LIMIT")}
                style={{
                  flex: 1,
                  border: "none",
                  borderRight: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  background: isLimit ? "rgba(59,130,246,0.22)" : "transparent",
                  color: isLimit ? "rgb(147,197,253)" : "rgba(255,255,255,0.3)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                LIMIT
              </button>
              <button
                onClick={() => setOrderType("MARKET")}
                style={{
                  flex: 1,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  background: isMarket
                    ? "rgba(245,158,11,0.18)"
                    : "transparent",
                  color: isMarket
                    ? "rgb(252,211,77)"
                    : "rgba(255,255,255,0.3)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                MKT
              </button>
            </div>
          </div>

          {/* Price + Qty — right 50% */}
          <div style={{ flex: 1, display: "flex", gap: 6 }}>
            <div
              style={{
                flex: 1,
                opacity: isLimit ? 1 : 0.35,
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
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Qty</span>
              <input
                type="number"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Row 2: BUY + SELL each taking half the width */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => submitOrder("BUY")}
            style={{
              flex: 1,
              height: 36,
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.05em",
              background: "rgb(22,163,74)",
              color: "white",
            }}
          >
            BUY
          </button>
          <button
            onClick={() => submitOrder("SELL")}
            style={{
              flex: 1,
              height: 36,
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.05em",
              background: "rgb(220,38,38)",
              color: "white",
            }}
          >
            SELL
          </button>
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
