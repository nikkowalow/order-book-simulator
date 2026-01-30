import React from "react";
import { useActivity } from "../hooks/useActivity";
import { OrderEvent, OrderEventType, OrderSide } from "../types/types";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function timeAgo(ts: number) {
  const now = Date.now();
  const eventTime = ts / 1_000_000; // ns → ms
  const diffMs = now - eventTime;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function getStatusStyle(type: OrderEventType): React.CSSProperties {
  switch (type) {
    case "NEW":
      return { color: "rgb(96, 165, 250)" }; // blue
    case "FILL":
      return { color: "rgb(34, 197, 94)" }; // green
    case "PARTIAL_FILL":
      return { color: "rgb(234, 179, 8)" }; // yellow
    case "CANCELLED":
      return { color: "rgb(156, 163, 175)" }; // gray
    case "REJECTED":
      return { color: "rgb(239, 68, 68)" }; // red
    default:
      return { color: "rgba(255,255,255,0.6)" };
  }
}

function formatStatus(type: OrderEventType): string {
  switch (type) {
    case "PARTIAL_FILL":
      return "PARTIAL";
    default:
      return type;
  }
}

export default function TradeHistory() {
  const { events, err } = useActivity(100);

  //   if (!events) return <div>Loading…</div>;
  const groupedEvents = React.useMemo(() => {
    const list = events ?? [];

    const groups: Record<number, OrderEvent[]> = {};
    for (const e of list) {
      (groups[e.batch_id] ??= []).push(e);
    }

    return Object.values(groups).reverse();
  }, [events]);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", color: "crimson" }}>
        Error fetching activity: {err}
      </div>
    );
  }

  if (!events) return <div style={{ maxWidth: 900 }}>Loading…</div>;

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          fontWeight: 700,
          letterSpacing: 0.3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        Book Activity
      </div>

      {/* Column labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          padding: "8px 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>Side</span>
        <span style={{ textAlign: "center" }}>Status</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Qty</span>
      </div>

      {/* Rows */}
      <div>
        {groupedEvents.map((group) => {
          const first = group[0];

          return (
            <div
              key={first.seq}
              style={{
                margin: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {/* Event header */}
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <span>Event</span>
                <span
                  style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)" }}
                >
                  {timeAgo(first.ts)}
                </span>
              </div>

              {group.map((e) => (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    padding: "6px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontFamily: "monospace",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 650,
                      color:
                        e.side === OrderSide.Buy
                          ? "rgb(34,197,94)"
                          : "rgb(239,68,68)",
                    }}
                  >
                    {e.side}
                  </span>
                  <span
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      ...getStatusStyle(e.type),
                    }}
                  >
                    {formatStatus(e.type)}
                  </span>

                  <span
                    style={{
                      textAlign: "right",
                      fontWeight: 650,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {fmt(e.price, 1)}
                  </span>

                  <span
                    style={{
                      textAlign: "right",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    {fmt(e.qty)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 12px",
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        Showing last {events.length} events
      </div>
    </div>
  );
}
