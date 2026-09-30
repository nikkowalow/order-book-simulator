import React from "react";
import { useActivity } from "../hooks/useActivity";
import { OrderEvent, OrderEventType, OrderSide } from "../types/types";
import Panel, { LiveTag } from "./Panel";
import { T, fmt } from "../theme";

const COLS = "0.8fr 1.2fr 1fr 0.8fr 1fr";

// Event `ts` is the engine's steady_clock in ns (time since host boot), not
// wall time — render it as an engine clock rather than "x ago".
function engineClock(ns: number) {
  const ms = Math.floor(ns / 1e6);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const h = Math.floor(ms / 3_600_000) % 24;
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

function deltaUs(ns: number) {
  const us = ns / 1000;
  return us < 1000 ? `+${us.toFixed(1)}µs` : `+${(us / 1000).toFixed(2)}ms`;
}

const STATUS: Record<OrderEventType, { label: string; color: string }> = {
  NEW: { label: "NEW", color: T.cyan },
  FILL: { label: "FILL", color: T.up },
  PARTIAL_FILL: { label: "PARTIAL", color: T.yellow },
  CANCELLED: { label: "CXL", color: T.dim },
  REJECTED: { label: "REJECT", color: T.down },
};

// Group consecutive events by batch. seq/batch_id restart with each server
// run, so ids alone aren't unique across the journal.
function groupBatches(events: OrderEvent[]) {
  const groups: OrderEvent[][] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last[0].batch_id === e.batch_id) last.push(e);
    else groups.push([e]);
  }
  // Newest batch first; events within a batch in the order they happened.
  return groups.map((g) => [...g].sort((a, b) => a.seq - b.seq));
}

export default function TradeHistory() {
  const { events, err } = useActivity(100);

  const groupedEvents = React.useMemo(
    () => groupBatches(events ?? []),
    [events],
  );

  return (
    <Panel
      code="EV"
      title="Book Activity"
      meta={
        err ? (
          <LiveTag label="FEED ERR" color={T.down} />
        ) : (
          <LiveTag label={events ? "POLL 1S" : "WAIT"} color={events ? T.up : T.yellow} />
        )
      }
      bodyStyle={{ overflow: "hidden" }}
    >
      <div
        className="t-cols"
        style={{ display: "grid", gridTemplateColumns: COLS, padding: "2px 6px" }}
      >
        <span>Side</span>
        <span>Type</span>
        <span style={{ textAlign: "right" }}>Px</span>
        <span style={{ textAlign: "right" }}>Qty</span>
        <span style={{ textAlign: "right" }}>Δ Batch</span>
      </div>

      {err && (
        <div
          className="blink"
          style={{
            padding: "3px 6px",
            background: "rgba(255,61,61,0.12)",
            color: T.down,
            fontWeight: 700,
            borderBottom: `1px solid ${T.down}`,
          }}
        >
          ERR /ACTIVITY: {err.toUpperCase()}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {!events && (
          <div className="blink" style={{ padding: 8, color: T.amber }}>
            LOADING ACTIVITY…
          </div>
        )}

        {groupedEvents.map((group) => {
          const first = group[0];
          return (
            <div
              key={`${first.batch_id}:${first.seq}:${first.ts}`}
              className="flash-new"
              style={{ borderBottom: `1px solid ${T.line}` }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "1px 6px",
                  background: "#0d0d0d",
                  color: T.amber,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                <span>BATCH #{first.batch_id}</span>
                <span style={{ color: T.dim }}>ENG {engineClock(first.ts)}</span>
              </div>

              {group.map((e) => {
                const status = STATUS[e.type] ?? { label: e.type, color: T.text };
                return (
                  <div
                    key={`${e.seq}:${e.ts}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: COLS,
                      padding: "1px 6px",
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: e.side === OrderSide.Buy ? T.up : T.down,
                      }}
                    >
                      {e.side}
                    </span>
                    <span
                      className={e.type === "REJECTED" ? "blink" : undefined}
                      style={{ fontWeight: 600, color: status.color }}
                    >
                      {status.label}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        color: e.price === 0 ? T.yellow : T.text,
                        fontWeight: 600,
                      }}
                    >
                      {e.price === 0 ? "MKT" : fmt(e.price, 1)}
                    </span>
                    <span style={{ textAlign: "right", color: T.text }}>
                      {fmt(e.qty)}
                    </span>
                    <span style={{ textAlign: "right", color: T.dim }}>
                      {e === first ? "—" : deltaUs(e.ts - first.ts)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="t-foot">
        <span>{events?.length ?? 0} EVENTS</span>
        <span>{groupedEvents.length} BATCHES</span>
      </div>
    </Panel>
  );
}
