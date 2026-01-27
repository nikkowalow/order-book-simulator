import { useMemo } from "react";
import { BarCell } from "./BarCell";
import { useBook } from "../hooks/useBook";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function OrderBookTable() {
  const { book, err } = useBook();

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

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
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
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 12px",
            color: "rgba(255,255,255,0.45)",
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
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
          }}
        >
          <span>Ask</span>
          <span>Size</span>
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          {Array.from({ length: depth }, (_, i) => {
            const lvl = book.bids[i];
            if (!lvl) {
              return (
                <div
                  key={`bid-empty-${i}`}
                  style={{
                    height: 28,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                />
              );
            }

            return (
              <div
                key={`bid-${lvl.price}`}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <BarCell side="bid" value={lvl.qty} max={maxQty}>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>
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
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                />
              );
            }

            return (
              <div
                key={`ask-${lvl.price}`}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <BarCell side="ask" value={lvl.qty} max={maxQty}>
                  <span style={{ color: "rgb(220,38,38)", fontWeight: 650 }}>
                    {fmt(lvl.price, 1)}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>
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
          color: "rgba(255,255,255,0.45)",
          background: "rgba(255,255,255,0.03)",
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
