import { useEffect, useState } from "react";
import LineChart from "./LineChart";
import { useAnalyticsStore } from "../stores/analyticsStore";

const MAX_POINTS = 60;

export default function Analytics() {
  const latencies = useAnalyticsStore((state) => state.latencies);
  return (
    <div
      className="panel"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.3 }}>
          Performance
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          Order latency (ms)
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}></div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <LineChart data={latencies} color="rgb(74,222,128)" />
      </div>
    </div>
  );
}
