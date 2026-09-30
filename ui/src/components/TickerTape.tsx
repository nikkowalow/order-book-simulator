import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import { Trade } from "../types/types";
import { T, fmt } from "../theme";

const SPEED = 55; // px per second
const BATCH = 16; // prints appended each time the tape runs low

type Tick = "up" | "down" | "flat";
type Item = { key: number; trade: Trade; tick: Tick; lead: boolean };

const TICK_STYLE: Record<Tick, { glyph: string; color: string }> = {
  up: { glyph: "▲", color: T.up },
  down: { glyph: "▼", color: T.down },
  flat: { glyph: "■", color: T.dim },
};

// `trades` is newest-first; the tape reads oldest → newest, left to right.
function nextBatch(trades: Trade[], startKey: number): Item[] {
  return trades
    .slice(0, BATCH)
    .map((trade, i) => {
      const prev = trades[i + 1];
      const tick: Tick =
        !prev || prev.price === trade.price
          ? "flat"
          : trade.price > prev.price
            ? "up"
            : "down";
      return { key: 0, trade, tick, lead: false };
    })
    .reverse()
    .map((item, i) => ({ ...item, key: startKey + i, lead: i === 0 }));
}

// Continuous crawl of recent prints. Items that scroll off the left are
// dropped and the offset is compensated before paint, so the tape never jumps.
export default function TickerTape() {
  const { trades } = useWebSocket();
  const [items, setItems] = useState<Item[]>([]);

  const tradesRef = useRef(trades);
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const dropped = useRef(0); // width removed from the head, applied after commit
  const pending = useRef(false); // an items update is in flight
  const nextKey = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;

      const box = boxRef.current;
      const track = trackRef.current;
      if (!box || !track || pending.current) return;

      if (!paused.current && !still) offset.current += SPEED * dt;

      const head = track.firstElementChild as HTMLElement | null;
      if (head && offset.current > head.offsetWidth) {
        dropped.current = head.offsetWidth;
        pending.current = true;
        setItems((prev) => prev.slice(1));
      } else if (track.offsetWidth - offset.current < box.clientWidth * 1.5) {
        const batch = nextBatch(tradesRef.current, nextKey.current);
        if (batch.length) {
          nextKey.current += batch.length;
          pending.current = true;
          setItems((prev) => [...prev, ...batch]);
        }
      }

      track.style.transform = `translateX(${-offset.current}px)`;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    offset.current -= dropped.current;
    dropped.current = 0;
    pending.current = false;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${-offset.current}px)`;
    }
  }, [items]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        background: "#040404",
        borderBottom: `1px solid ${T.line}`,
        fontSize: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 8px",
          background: T.navy,
          color: T.navyText,
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        <span className="led blink" style={{ color: T.down, width: 7, height: 7 }} />
        PRINTS
      </div>

      <div
        ref={boxRef}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
      >
        {items.length === 0 && (
          <span
            className="blink"
            style={{ position: "absolute", left: 10, top: 2, color: T.dim }}
          >
            AWAITING PRINTS…
          </span>
        )}
        <div
          ref={trackRef}
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            width: "max-content",
            whiteSpace: "nowrap",
            willChange: "transform",
          }}
        >
          {items.map(({ key, trade, tick, lead }) => {
            const { glyph, color } = TICK_STYLE[tick];
            return (
              <span key={key} style={{ display: "flex", alignItems: "center" }}>
                {lead && (
                  <span style={{ color: T.amber, fontWeight: 700, padding: "0 14px" }}>
                    ◆ OSM
                  </span>
                )}
                <span style={{ padding: "0 12px", color }}>
                  {glyph}{" "}
                  <span style={{ fontWeight: 700 }}>{fmt(trade.price, 1)}</span>
                  <span style={{ color: T.dim }}> × </span>
                  <span style={{ color: T.text }}>{fmt(trade.qty)}</span>
                  <span style={{ color: T.mute }}> #{trade.trade_id}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
