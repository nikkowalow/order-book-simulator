import React, { useState } from "react";

export default function OrderEntry() {
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [cancelId, setCancelId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [orderLatencyMs, setOrderLatencyMs] = useState<number | null>(null);
  const [cancelLatencyMs, setCancelLatencyMs] = useState<number | null>(null);

  const submitOrder = async (side: "BUY" | "SELL") => {
    console.log("Submitting order", { side, price, qty, orderType });
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

    const body: Record<string, unknown> = { side, qty: q, type: orderType };
    if (orderType === "LIMIT") {
      body.price = parseInt(price, 10);
    }

    const t0 = performance.now();
    try {
      const res = await fetch("http://localhost:8080/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const t1 = performance.now();
      setOrderLatencyMs(t1 - t0);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error
          ? `HTTP ${res.status}: ${data.error}`
          : `HTTP ${res.status}`;
        setStatus(msg);
        return;
      }

      setStatus(`Order ${data.id}: ${data.trades?.length || 0} trades`);
    } catch (e: any) {
      const t1 = performance.now();
      setOrderLatencyMs(t1 - t0);
      setStatus(`Error: ${e?.message ?? "request failed"}`);
    }
  };

  const submitCancel = async () => {
    const id = parseInt(cancelId, 10);
    if (!id || id <= 0) {
      setStatus("Invalid order ID");
      return;
    }

    setStatus(null);

    const t0 = performance.now();
    try {
      const res = await fetch("http://localhost:8080/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const t1 = performance.now();
      setCancelLatencyMs(t1 - t0);

      const data = await res.json();
      setStatus(data.ok ? "Cancelled" : "Not found");
    } catch (e: any) {
      const t1 = performance.now();
      setCancelLatencyMs(t1 - t0);
      setStatus(`Error: ${e.message}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    fontSize: 14,
    width: 80,
    background: "rgba(255,255,255,0.05)",
    color: "inherit",
  };

  const btnBase: React.CSSProperties = {
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div
      className="panel"
      style={{
        maxWidth: 900,
        margin: "24px auto 16px",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {(["LIMIT", "MARKET"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              style={{
                ...btnBase,
                borderRadius: 0,
                padding: "8px 12px",
                fontSize: 12,
                background:
                  orderType === t ? "rgba(255,255,255,0.15)" : "transparent",
                color:
                  orderType === t
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.4)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={orderType !== "LIMIT"}
          style={{
            ...inputStyle,
            backgroundColor: orderType === "LIMIT" ? "#2a2a2a" : "#2a2a2a",
            color: orderType === "LIMIT" ? "#fff" : "#888",
            cursor: orderType === "LIMIT" ? "text" : "not-allowed",
          }}
        />
        <input
          type="number"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={() => submitOrder("BUY")}
          style={{ ...btnBase, background: "rgb(22,163,74)", color: "white" }}
        >
          Buy
        </button>
        <button
          onClick={() => submitOrder("SELL")}
          style={{ ...btnBase, background: "rgb(220,38,38)", color: "white" }}
        >
          Sell
        </button>
        <div
          style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)" }}
        />
        <input
          type="number"
          placeholder="Order ID"
          value={cancelId}
          onChange={(e) => setCancelId(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={submitCancel}
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Cancel
        </button>
        {status && (
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            {status}
          </span>
        )}
        <div style={{ flexBasis: "100%", height: 0 }} />

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            Order latency:{" "}
            <strong style={{ color: "rgba(255,255,255,0.75)" }}>
              {orderLatencyMs == null ? "—" : `${orderLatencyMs.toFixed(1)} ms`}
            </strong>
          </span>

          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            Cancel latency:{" "}
            <strong style={{ color: "rgba(255,255,255,0.75)" }}>
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
