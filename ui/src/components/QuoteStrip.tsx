import { ReactNode, useMemo } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import Flash from "./Flash";
import { T, fmt } from "../theme";

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        padding: "0 10px",
        borderLeft: `1px solid ${T.line}`,
        whiteSpace: "nowrap",
      }}
    >
      <span className="t-label">{label}</span>
      <span style={{ color: T.text, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

// Security header: top of book + stats over the prints in the trade buffer.
export default function QuoteStrip() {
  const { book, trades } = useWebSocket();

  const bid = book?.bids[0] ?? null;
  const ask = book?.asks[0] ?? null;
  const mid = bid && ask ? (bid.price + ask.price) / 2 : null;
  const spread = bid && ask ? ask.price - bid.price : null;

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    let hi = -Infinity;
    let lo = Infinity;
    let vol = 0;
    let notional = 0;
    for (const t of trades) {
      hi = Math.max(hi, t.price);
      lo = Math.min(lo, t.price);
      vol += t.qty;
      notional += t.price * t.qty;
    }
    const last = trades[0].price;
    const first = trades[trades.length - 1].price;
    return {
      last,
      chg: last - first,
      pct: first ? ((last - first) / first) * 100 : 0,
      hi,
      lo,
      vol,
      vwap: vol ? notional / vol : 0,
      prints: trades.length,
    };
  }, [trades]);

  const imbalance = useMemo(() => {
    if (!book) return null;
    const b = book.bids.reduce((s, l) => s + l.qty, 0);
    const a = book.asks.reduce((s, l) => s + l.qty, 0);
    return b + a > 0 ? ((b - a) / (b + a)) * 100 : 0;
  }, [book]);

  const chgColor = !stats || stats.chg === 0 ? T.text : stats.chg > 0 ? T.up : T.down;
  const arrow = !stats || stats.chg === 0 ? "■" : stats.chg > 0 ? "▲" : "▼";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: T.panel,
        border: `1px solid ${T.line}`,
        boxSizing: "border-box",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: "#111",
        }}
      >
        <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>OSM</span>
        <span
          style={{
            background: T.yellow,
            color: "#000",
            fontWeight: 700,
            fontSize: 10,
            padding: "1px 4px",
          }}
        >
          SIM
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: "0 12px",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: chgColor, fontSize: 12 }}>{arrow}</span>
        <Flash
          value={stats?.last}
          style={{ fontSize: 18, fontWeight: 700, color: T.text }}
        >
          {stats ? fmt(stats.last, 1) : "—"}
        </Flash>
        <span style={{ color: chgColor, fontWeight: 600 }}>
          {stats
            ? `${stats.chg >= 0 ? "+" : ""}${fmt(stats.chg, 1)} ${stats.pct >= 0 ? "+" : ""}${stats.pct.toFixed(2)}%`
            : ""}
        </span>
      </div>

      <Cell label="Bid">
        <Flash value={bid?.price} style={{ color: T.up }}>
          {bid ? fmt(bid.price, 1) : "—"}
        </Flash>
        <span style={{ color: T.dim }}> × </span>
        <Flash value={bid?.qty}>{bid ? fmt(bid.qty) : "—"}</Flash>
      </Cell>
      <Cell label="Ask">
        <Flash value={ask?.price} style={{ color: T.down }}>
          {ask ? fmt(ask.price, 1) : "—"}
        </Flash>
        <span style={{ color: T.dim }}> × </span>
        <Flash value={ask?.qty}>{ask ? fmt(ask.qty) : "—"}</Flash>
      </Cell>
      <Cell label="Sprd">
        <Flash value={spread}>{spread != null ? fmt(spread, 1) : "—"}</Flash>
      </Cell>
      <Cell label="Mid">
        <Flash value={mid}>{mid != null ? fmt(mid, 2) : "—"}</Flash>
      </Cell>
      <Cell label="Hi">
        <Flash value={stats?.hi}>{stats ? fmt(stats.hi, 1) : "—"}</Flash>
      </Cell>
      <Cell label="Lo">
        <Flash value={stats?.lo}>{stats ? fmt(stats.lo, 1) : "—"}</Flash>
      </Cell>
      <Cell label="VWAP">
        <Flash value={stats?.vwap}>{stats ? fmt(stats.vwap, 2) : "—"}</Flash>
      </Cell>
      <Cell label="Vol">
        <Flash value={stats?.vol}>{stats ? fmt(stats.vol) : "—"}</Flash>
      </Cell>
      <Cell label="Prints">
        <Flash value={stats?.prints}>{stats ? fmt(stats.prints) : "—"}</Flash>
      </Cell>
      <Cell label="Imbal">
        <span
          style={{
            color: imbalance == null || imbalance === 0 ? T.text : imbalance > 0 ? T.up : T.down,
          }}
        >
          <Flash value={imbalance == null ? null : Math.round(imbalance * 10)}>
            {imbalance == null
              ? "—"
              : `${imbalance > 0 ? "+" : ""}${imbalance.toFixed(1)}%`}
          </Flash>
        </span>
      </Cell>

      <span
        style={{
          marginLeft: "auto",
          padding: "0 10px",
          color: T.mute,
          fontSize: 10,
          whiteSpace: "nowrap",
        }}
      >
        LAST {stats?.prints ?? 0} PRINTS
      </span>
    </div>
  );
}
