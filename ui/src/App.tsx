import React, { useEffect, useMemo, useState } from "react";
import { BarCell } from "./components/BarCell";
type Side = "bid" | "ask";

type Level = {
  price: number;
  qty: number;
};

type Book = {
  bids: Level[]; // descending by price
  asks: Level[]; // ascending by price
};

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function OrderBookTable() {
  const [book, setBook] = useState<Book | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [cancelId, setCancelId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [orderLatencyMs, setOrderLatencyMs] = useState<number | null>(null);
  const [cancelLatencyMs, setCancelLatencyMs] = useState<number | null>(null);

  const submitOrder = async (side: "BUY" | "SELL") => {
    const p = parseInt(price, 10);
    const q = parseInt(qty, 10);
    if (!p || !q || p <= 0 || q <= 0) {
      setStatus("Invalid price or qty");
      return;
    }

    setStatus(null);

    const t0 = performance.now();
    try {
      const res = await fetch("http://localhost:8080/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, price: p, qty: q }),
      });

      const t1 = performance.now();
      setOrderLatencyMs(t1 - t0);

      // If server returns non-2xx, still try to read error json
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
    try {
      const res = await fetch("http://localhost:8080/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setStatus(data.ok ? "Cancelled" : "Not found");
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchBook = async () => {
      try {
        setErr(null);
        const res = await fetch("http://localhost:8080/book", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as Book;

        if (!cancelled) setBook(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to fetch /book");
      }
    };

    fetchBook();
    const id = setInterval(fetchBook, 5); // polling interval

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const maxQty = useMemo(() => {
    if (!book) return 1;
    const all = [...book.bids, ...book.asks].map((l) => l.qty);
    return all.length ? Math.max(...all) : 1;
  }, [book]);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", color: "crimson" }}>
        Error fetching book: {err}
      </div>
    );
  }

  if (!book)
    return <div style={{ maxWidth: 900, margin: "24px auto" }}>Loading…</div>;

  const depth = Math.max(book.bids.length, book.asks.length);

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 6,
    fontSize: 14,
    width: 80,
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
    <>
      {/* Order Form */}
      <div
        style={{
          maxWidth: 900,
          margin: "24px auto 16px",
          padding: 16,
          background: "white",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
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
          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={inputStyle}
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
            style={{ width: 1, height: 32, background: "rgba(0,0,0,0.1)" }}
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
              background: "rgba(0,0,0,0.08)",
              color: "rgba(0,0,0,0.7)",
            }}
          >
            Cancel
          </button>
          {status && (
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
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
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Order latency:{" "}
              <strong style={{ color: "rgba(0,0,0,0.75)" }}>
                {orderLatencyMs == null
                  ? "—"
                  : `${orderLatencyMs.toFixed(1)} ms`}
              </strong>
            </span>

            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Cancel latency:{" "}
              <strong style={{ color: "rgba(0,0,0,0.75)" }}>
                {cancelLatencyMs == null
                  ? "—"
                  : `${cancelLatencyMs.toFixed(1)} ms`}
              </strong>
            </span>

            {status && (
              <span style={{ fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
                {status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Order Book */}
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          overflow: "hidden",
          background: "white",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            Bids
          </div>
          <div
            style={{
              padding: "10px 12px",
              fontWeight: 700,
              letterSpacing: 0.3,
              textAlign: "right",
            }}
          >
            Asks
          </div>
        </div>

        {/* Column labels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 12px",
              color: "rgba(0,0,0,0.55)",
              fontSize: 12,
            }}
          >
            <span>Size</span>
            <span>Bid</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 12px",
              color: "rgba(0,0,0,0.55)",
              fontSize: 12,
            }}
          >
            <span>Ask</span>
            <span>Size</span>
          </div>
        </div>

        {/* Rows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            {Array.from({ length: depth }, (_, i) => {
              const lvl = book.bids[i];
              if (!lvl) {
                return (
                  <div
                    key={`bid-empty-${i}`}
                    style={{
                      height: 28,
                      borderBottom: "1px solid rgba(0,0,0,0.04)",
                    }}
                  />
                );
              }

              return (
                <div
                  key={`bid-${lvl.price}`}
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <BarCell side="bid" value={lvl.qty} max={maxQty}>
                    <span style={{ color: "rgba(0,0,0,0.85)" }}>
                      {fmt(lvl.qty)}
                    </span>
                    <span style={{ color: "rgb(22,163,74)", fontWeight: 650 }}>
                      {fmt(lvl.price, 1)}
                    </span>
                  </BarCell>
                </div>
              );
            })}
          </div>

          <div>
            {Array.from({ length: depth }, (_, i) => {
              const lvl = book.asks[i];
              if (!lvl) {
                return (
                  <div
                    key={`ask-empty-${i}`}
                    style={{
                      height: 28,
                      borderBottom: "1px solid rgba(0,0,0,0.04)",
                    }}
                  />
                );
              }

              return (
                <div
                  key={`ask-${lvl.price}`}
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <BarCell side="ask" value={lvl.qty} max={maxQty}>
                    <span style={{ color: "rgb(220,38,38)", fontWeight: 650 }}>
                      {fmt(lvl.price, 1)}
                    </span>
                    <span style={{ color: "rgba(0,0,0,0.85)" }}>
                      {fmt(lvl.qty)}
                    </span>
                  </BarCell>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 12px",
            fontSize: 12,
            color: "rgba(0,0,0,0.55)",
            background: "rgba(0,0,0,0.02)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Depth: {depth}</span>
          <span>Max size: {fmt(maxQty)}</span>
        </div>
      </div>
    </>
  );
}
