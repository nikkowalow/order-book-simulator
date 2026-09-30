import { useMemo } from "react";
import LineChart from "./LineChart";
import Panel from "./Panel";
import Flash from "./Flash";
import { useAnalyticsStore } from "../stores/analyticsStore";
import { T } from "../theme";

function Stat({ label, value, color = T.text }: { label: string; value: number | null; color?: string }) {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: T.amber }}>{label}</span>{" "}
      <span style={{ color }}>{value == null ? "—" : value.toFixed(2)}</span>
    </span>
  );
}

export default function Analytics() {
  const latencies = useAnalyticsStore((state) => state.latencies);

  const stats = useMemo(() => {
    if (latencies.length === 0) return null;
    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      last: latencies[latencies.length - 1],
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
      max: sorted[sorted.length - 1],
    };
  }, [latencies]);

  return (
    <Panel
      code="LT"
      title="Order RTT · ms"
      meta={<span>N {latencies.length}</span>}
      bodyStyle={{ overflow: "hidden" }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 10,
          padding: "2px 6px",
          fontSize: 13,
          fontWeight: 600,
          borderBottom: `1px solid ${T.lineSoft}`,
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: T.amber }}>LAST</span>{" "}
          <Flash value={stats?.last} style={{ color: T.cyan }}>
            {stats ? stats.last.toFixed(2) : "—"}
          </Flash>
        </span>
        <Stat label="AVG" value={stats?.avg ?? null} />
        <Stat label="P95" value={stats?.p95 ?? null} color={T.yellow} />
        <Stat label="MAX" value={stats?.max ?? null} color={T.down} />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {latencies.length === 0 ? (
          <div style={{ padding: 8, color: T.mute, fontSize: 13 }}>
            NO ORDERS SENT · SUBMIT VIA TICKET BELOW
          </div>
        ) : (
          <LineChart data={latencies} color={T.cyan} />
        )}
      </div>
    </Panel>
  );
}
