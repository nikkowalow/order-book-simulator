import { useMemo } from "react";
import { BarCell, ROW_HEIGHT } from "./BarCell";
import { VolumeBar } from "./VolumeBar";
import { useWebSocket } from "../context/WebSocketContext";
import { MarketPrice } from "./MarketPrice";
import Panel, { LiveTag } from "./Panel";
import Flash from "./Flash";
import { Level } from "../types/types";
import { T, fmt } from "../theme";

const BID_COLS = "0.6fr 1fr 1fr 1fr"; // ORDS  TOTAL  SIZE  BID
const ASK_COLS = "1fr 1fr 1fr 0.6fr"; // ASK   SIZE   TOTAL ORDS

type Row = Level & { total: number };

function withTotals(levels: Level[]): Row[] {
  let total = 0;
  return levels.map((l) => ({ ...l, total: (total += l.qty) }));
}

const right: React.CSSProperties = { textAlign: "right" };

function EmptyRow() {
  return (
    <div
      style={{ height: ROW_HEIGHT, borderBottom: `1px solid ${T.lineSoft}` }}
    />
  );
}

export default function OrderBookTable() {
  const { book } = useWebSocket();

  const maxQty = useMemo(() => {
    if (!book) return 1;
    const all = [...book.bids, ...book.asks].map((l) => l.qty);
    return all.length ? Math.max(...all) : 1;
  }, [book]);

  const bids = useMemo(() => withTotals(book?.bids ?? []), [book]);
  const asks = useMemo(() => withTotals(book?.asks ?? []), [book]);
  const bidVolume = bids.length ? bids[bids.length - 1].total : 0;
  const askVolume = asks.length ? asks[asks.length - 1].total : 0;
  const depth = Math.max(bids.length, asks.length);

  return (
    <Panel
      code="OB"
      title="Order Book · L2"
      meta={
        <>
          <span>DEPTH {depth}</span>
          <LiveTag label={book ? "LIVE" : "WAIT"} color={book ? T.up : T.yellow} />
        </>
      }
      bodyStyle={{ overflow: "hidden" }}
    >
      {!book ? (
        <div className="blink" style={{ padding: 12, color: T.amber }}>
          LOADING BOOK…
        </div>
      ) : (
        <>
          {/* Side labels + mid */}
          <div
            style={{
              flexShrink: 0,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              borderBottom: `1px solid ${T.line}`,
              background: "#0b0b0b",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ padding: "0 8px", color: T.up }}>▌BIDS</span>
            <MarketPrice />
            <span style={{ padding: "0 8px", color: T.down, textAlign: "right" }}>
              ASKS▐
            </span>
          </div>

          {/* Column labels */}
          <div
            className="t-cols"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: BID_COLS,
                padding: "2px 6px",
                borderRight: `1px solid ${T.line}`,
              }}
            >
              <span>Ords</span>
              <span style={right}>Total</span>
              <span style={right}>Size</span>
              <span style={right}>Bid</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ASK_COLS,
                padding: "2px 6px",
              }}
            >
              <span>Ask</span>
              <span style={right}>Size</span>
              <span style={right}>Total</span>
              <span style={right}>Ords</span>
            </div>
          </div>

          {/* Levels */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              alignContent: "start",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <div style={{ borderRight: `1px solid ${T.line}` }}>
              {Array.from({ length: depth }, (_, i) => {
                const lvl = bids[i];
                if (!lvl) return <EmptyRow key={`bid-empty-${i}`} />;
                return (
                  <div
                    key={`bid-${lvl.price}`}
                    className="flash-new"
                    style={{ borderBottom: `1px solid ${T.lineSoft}` }}
                  >
                    <BarCell
                      side="bid"
                      value={lvl.qty}
                      max={maxQty}
                      columns={BID_COLS}
                      highlight={i === 0}
                    >
                      <span style={{ color: T.dim }}>{lvl.orders?.length ?? ""}</span>
                      <span style={{ ...right, color: T.dim }}>{fmt(lvl.total)}</span>
                      <span style={right}>
                        <Flash value={lvl.qty} style={{ color: T.text }}>
                          {fmt(lvl.qty)}
                        </Flash>
                      </span>
                      <span style={{ ...right, color: T.up, fontWeight: 700 }}>
                        {fmt(lvl.price, 1)}
                      </span>
                    </BarCell>
                  </div>
                );
              })}
            </div>

            <div>
              {Array.from({ length: depth }, (_, i) => {
                const lvl = asks[i];
                if (!lvl) return <EmptyRow key={`ask-empty-${i}`} />;
                return (
                  <div
                    key={`ask-${lvl.price}`}
                    className="flash-new"
                    style={{ borderBottom: `1px solid ${T.lineSoft}` }}
                  >
                    <BarCell
                      side="ask"
                      value={lvl.qty}
                      max={maxQty}
                      columns={ASK_COLS}
                      highlight={i === 0}
                    >
                      <span style={{ color: T.down, fontWeight: 700 }}>
                        {fmt(lvl.price, 1)}
                      </span>
                      <span style={right}>
                        <Flash value={lvl.qty} style={{ color: T.text }}>
                          {fmt(lvl.qty)}
                        </Flash>
                      </span>
                      <span style={{ ...right, color: T.dim }}>{fmt(lvl.total)}</span>
                      <span style={{ ...right, color: T.dim }}>
                        {lvl.orders?.length ?? ""}
                      </span>
                    </BarCell>
                  </div>
                );
              })}
            </div>
          </div>

          <VolumeBar bidVolume={bidVolume} askVolume={askVolume} />

          <div className="t-foot">
            <span>LVLS {bids.length}/{asks.length}</span>
            <span>MAX LVL {fmt(maxQty)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}
