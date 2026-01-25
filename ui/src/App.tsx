import React, { useEffect, useMemo, useState } from "react";

type Side = "bid" | "ask";

type Level = {
  price: number;
  qty: number;
};

type Book = {
  bids: Level[]; // descending by price
  asks: Level[]; // ascending by price
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function makeDummyBook(mid = 126.1, depth = 12): Book {
  const bids: Level[] = Array.from({ length: depth }, (_, i) => {
    const price = +(mid - 0.1 * (i + 1)).toFixed(1);
    const qty = Math.round(10 + Math.random() * 240);
    return { price, qty };
  });

  const asks: Level[] = Array.from({ length: depth }, (_, i) => {
    const price = +(mid + 0.1 * (i + 1)).toFixed(1);
    const qty = Math.round(10 + Math.random() * 240);
    return { price, qty };
  });

  return { bids, asks };
}

function BarCell({
  side,
  value,
  max,
  children,
}: {
  side: Side;
  value: number;
  max: number;
  children: React.ReactNode;
}) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  // Bar sits behind text; bids fill from left -> right, asks fill from right -> left
  const barStyle: React.CSSProperties =
    side === "bid"
      ? {
          left: 0,
          width: `${pct}%`,
          background:
            "linear-gradient(90deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.40) 100%)",
        }
      : {
          right: 0,
          width: `${pct}%`,
          background:
            "linear-gradient(270deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.40) 100%)",
        };

  return (
    <div
      style={{
        position: "relative",
        height: 28,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          borderRadius: 6,
          transition: "width 180ms ease",
          ...barStyle,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function OrderBookTable() {
  const [book, setBook] = useState<Book>(() => makeDummyBook());

  useEffect(() => {
    const id = setInterval(() => {
      setBook(makeDummyBook());
    }, 500);
    return () => clearInterval(id);
  }, []);

  const depth = Math.max(book.bids.length, book.asks.length);

  const maxQty = useMemo(() => {
    const all = [...book.bids, ...book.asks].map((l) => l.qty);
    return all.length ? Math.max(...all) : 1;
  }, [book]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "24px auto",
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
  );
}
