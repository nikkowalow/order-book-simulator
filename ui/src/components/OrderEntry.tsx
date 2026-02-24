import React, { useState } from "react";
import { useWebSocket } from "../context/WebSocketContext";

export default function OrderEntry() {
  const { send } = useWebSocket();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [cancelId, setCancelId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [orderLatencyMs, setOrderLatencyMs] = useState<number | null>(null);
  const [cancelLatencyMs, setCancelLatencyMs] = useState<number | null>(null);

  const submitOrder = async (side: "BUY" | "SELL") => {
    let t1 = performance.now();
    console.log(`t1 = ${t1.toFixed(1)} ms`);
    const q = parseInt(qty, 10);
    if (!q || q <= 0) {
      setStatus("Invalid qty");
      return;
    }

    if (orderType === "LIMIT") {
      const p = parseInt(price, 10);
      if (!p || p <= 0) {
        setStatus("Invalid price");
        return;
      }
    }

    setStatus(null);

    const msg: Record<string, unknown> = {
      action: "order",
      side,
      qty: q,
      type: orderType,
    };
    if (orderType === "LIMIT") {
      msg.price = parseInt(price, 10);
    }

    try {
      const { msg: data } = await send(msg);
      //   setOrderLatencyMs(rtt);

      if (data.error) {
        setStatus(data.error);
        return;
      }

      setStatus(`Order ${data.id}: ${data.trades?.length || 0} trades`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? "request failed"}`);
    }
    let t2 = performance.now();
    console.log(`Order round-trip time: ${(t2 - t1).toFixed(1)} ms`);
    setOrderLatencyMs(t2 - t1);
  };

  const submitCancel = async () => {
    const id = parseInt(cancelId, 10);
    if (!id || id <= 0) {
      setStatus("Invalid order ID");
      return;
    }

    setStatus(null);

    try {
      const { msg: data, rtt } = await send({ action: "cancel", id });
      setCancelLatencyMs(rtt);

      if (data.error) {
        setStatus(data.error);
        return;
      }

      setStatus(data.ok ? "Cancelled" : "Not found");
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? "request failed"}`);
    }
  };

  const isError =
    status?.startsWith("Error") ||
    status?.startsWith("Invalid") ||
    status === "Not found";

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

        {/* Status message */}
        {status && (
          <span
            style={{
              fontSize: 12,
              color: isError ? "rgb(248,113,113)" : "rgba(255,255,255,0.45)",
              alignSelf: "center",
            }}
          >
            {status}
          </span>
        )}

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
    </div>
  );
}
