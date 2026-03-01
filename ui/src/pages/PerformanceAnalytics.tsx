import React, { useCallback, useMemo, useState } from "react";
import Header from "../components/Header";
import { SERVER_URL } from "../config/config";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type PercentilePoint = { p: number; value_us: number };
type HistogramBucket = { le_us: string; count: number };
type Scenario = {
  n: number;
  avg_us: number;
  p50_us: number;
  p90_us: number;
  p99_us: number;
  max_us: number;
  percentile_curve: PercentilePoint[];
  histogram: HistogramBucket[];
};
type BenchmarkData = { scenarios: Record<string, Scenario> };

// ─── Seed data (used as fallback when server is unreachable) ─────────────────

const SEED_DATA: BenchmarkData = {
  scenarios: {
    "resting limit": {
      n: 50000,
      avg_us: 1.097,
      p50_us: 1.0,
      p90_us: 1.375,
      p99_us: 1.584,
      max_us: 160.75,
      percentile_curve: [
        { p: 1.0, value_us: 0.875 },
        { p: 5.0, value_us: 0.875 },
        { p: 10.0, value_us: 0.916 },
        { p: 25.0, value_us: 0.917 },
        { p: 50.0, value_us: 1.0 },
        { p: 75.0, value_us: 1.167 },
        { p: 90.0, value_us: 1.375 },
        { p: 95.0, value_us: 1.417 },
        { p: 99.0, value_us: 1.584 },
        { p: 99.5, value_us: 1.666 },
        { p: 99.9, value_us: 5.833 },
      ],
      histogram: [
        { le_us: "1.00", count: 25512 },
        { le_us: "1.25", count: 16689 },
        { le_us: "1.50", count: 6865 },
        { le_us: "2.00", count: 832 },
        { le_us: "3.00", count: 23 },
        { le_us: "5.00", count: 21 },
        { le_us: "10.00", count: 30 },
        { le_us: "25.00", count: 15 },
        { le_us: "50.00", count: 7 },
        { le_us: "100.00", count: 4 },
        { le_us: "250.00", count: 2 },
      ],
    },
    "aggressive limit": {
      n: 50000,
      avg_us: 0.861,
      p50_us: 0.875,
      p90_us: 1.0,
      p99_us: 1.458,
      max_us: 98.0,
      percentile_curve: [
        { p: 1.0, value_us: 0.625 },
        { p: 5.0, value_us: 0.625 },
        { p: 10.0, value_us: 0.666 },
        { p: 25.0, value_us: 0.708 },
        { p: 50.0, value_us: 0.875 },
        { p: 75.0, value_us: 0.958 },
        { p: 90.0, value_us: 1.0 },
        { p: 95.0, value_us: 1.041 },
        { p: 99.0, value_us: 1.458 },
        { p: 99.5, value_us: 1.583 },
        { p: 99.9, value_us: 4.958 },
      ],
      histogram: [
        { le_us: "0.75", count: 19463 },
        { le_us: "1.00", count: 27768 },
        { le_us: "1.25", count: 2159 },
        { le_us: "1.50", count: 256 },
        { le_us: "2.00", count: 259 },
        { le_us: "3.00", count: 27 },
        { le_us: "5.00", count: 19 },
        { le_us: "10.00", count: 31 },
        { le_us: "25.00", count: 8 },
        { le_us: "50.00", count: 9 },
        { le_us: "100.00", count: 1 },
      ],
    },
    cancel: {
      n: 50000,
      avg_us: 0.528,
      p50_us: 0.541,
      p90_us: 0.542,
      p99_us: 0.625,
      max_us: 12.916,
      percentile_curve: [
        { p: 1.0, value_us: 0.458 },
        { p: 5.0, value_us: 0.5 },
        { p: 10.0, value_us: 0.5 },
        { p: 25.0, value_us: 0.5 },
        { p: 50.0, value_us: 0.541 },
        { p: 75.0, value_us: 0.542 },
        { p: 90.0, value_us: 0.542 },
        { p: 95.0, value_us: 0.583 },
        { p: 99.0, value_us: 0.625 },
        { p: 99.5, value_us: 0.666 },
        { p: 99.9, value_us: 0.75 },
      ],
      histogram: [
        { le_us: "0.50", count: 21787 },
        { le_us: "0.75", count: 28169 },
        { le_us: "1.00", count: 12 },
        { le_us: "1.25", count: 1 },
        { le_us: "1.50", count: 4 },
        { le_us: "2.00", count: 5 },
        { le_us: "3.00", count: 5 },
        { le_us: "5.00", count: 10 },
        { le_us: "10.00", count: 6 },
        { le_us: "25.00", count: 1 },
      ],
    },
    "mixed (60/30/10)": {
      n: 50000,
      avg_us: 1.062,
      p50_us: 1.0,
      p90_us: 1.084,
      p99_us: 2.042,
      max_us: 196.458,
      percentile_curve: [
        { p: 1.0, value_us: 0.667 },
        { p: 5.0, value_us: 0.791 },
        { p: 10.0, value_us: 0.958 },
        { p: 25.0, value_us: 1.0 },
        { p: 50.0, value_us: 1.0 },
        { p: 75.0, value_us: 1.042 },
        { p: 90.0, value_us: 1.084 },
        { p: 95.0, value_us: 1.125 },
        { p: 99.0, value_us: 2.042 },
        { p: 99.5, value_us: 4.0 },
        { p: 99.9, value_us: 8.333 },
      ],
      histogram: [
        { le_us: "0.75", count: 2343 },
        { le_us: "1.00", count: 23992 },
        { le_us: "1.25", count: 22934 },
        { le_us: "1.50", count: 195 },
        { le_us: "2.00", count: 35 },
        { le_us: "3.00", count: 48 },
        { le_us: "5.00", count: 278 },
        { le_us: "10.00", count: 140 },
        { le_us: "25.00", count: 23 },
        { le_us: "50.00", count: 6 },
        { le_us: "100.00", count: 4 },
        { le_us: "250.00", count: 2 },
      ],
    },
    "mkt sweep  3 levels": {
      n: 50000,
      avg_us: 1.41,
      p50_us: 1.375,
      p90_us: 1.459,
      p99_us: 1.583,
      max_us: 54.208,
      percentile_curve: [
        { p: 1.0, value_us: 1.25 },
        { p: 5.0, value_us: 1.292 },
        { p: 10.0, value_us: 1.333 },
        { p: 25.0, value_us: 1.334 },
        { p: 50.0, value_us: 1.375 },
        { p: 75.0, value_us: 1.417 },
        { p: 90.0, value_us: 1.459 },
        { p: 95.0, value_us: 1.5 },
        { p: 99.0, value_us: 1.583 },
        { p: 99.5, value_us: 1.625 },
        { p: 99.9, value_us: 6.667 },
      ],
      histogram: [
        { le_us: "1.25", count: 548 },
        { le_us: "1.50", count: 47910 },
        { le_us: "2.00", count: 1424 },
        { le_us: "3.00", count: 29 },
        { le_us: "5.00", count: 11 },
        { le_us: "10.00", count: 52 },
        { le_us: "25.00", count: 21 },
        { le_us: "50.00", count: 4 },
        { le_us: "100.00", count: 1 },
      ],
    },
    "mkt sweep 10 levels": {
      n: 50000,
      avg_us: 4.114,
      p50_us: 4.042,
      p90_us: 4.25,
      p99_us: 4.958,
      max_us: 74.25,
      percentile_curve: [
        { p: 1.0, value_us: 3.709 },
        { p: 5.0, value_us: 3.792 },
        { p: 10.0, value_us: 3.834 },
        { p: 25.0, value_us: 3.958 },
        { p: 50.0, value_us: 4.042 },
        { p: 75.0, value_us: 4.166 },
        { p: 90.0, value_us: 4.25 },
        { p: 95.0, value_us: 4.334 },
        { p: 99.0, value_us: 4.958 },
        { p: 99.5, value_us: 8.042 },
        { p: 99.9, value_us: 19.708 },
      ],
      histogram: [
        { le_us: "5.00", count: 49518 },
        { le_us: "10.00", count: 333 },
        { le_us: "25.00", count: 122 },
        { le_us: "50.00", count: 23 },
        { le_us: "100.00", count: 4 },
      ],
    },
    "mkt sweep 20 levels": {
      n: 50000,
      avg_us: 7.751,
      p50_us: 7.625,
      p90_us: 8.042,
      p99_us: 11.166,
      max_us: 77.542,
      percentile_curve: [
        { p: 1.0, value_us: 7.042 },
        { p: 5.0, value_us: 7.208 },
        { p: 10.0, value_us: 7.292 },
        { p: 25.0, value_us: 7.458 },
        { p: 50.0, value_us: 7.625 },
        { p: 75.0, value_us: 7.833 },
        { p: 90.0, value_us: 8.042 },
        { p: 95.0, value_us: 8.208 },
        { p: 99.0, value_us: 11.166 },
        { p: 99.5, value_us: 13.583 },
        { p: 99.9, value_us: 26.625 },
      ],
      histogram: [
        { le_us: "10.00", count: 49373 },
        { le_us: "25.00", count: 569 },
        { le_us: "50.00", count: 51 },
        { le_us: "100.00", count: 7 },
      ],
    },
  },
};

// ─── Style constants ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(255,255,255,0.3)",
  marginBottom: 14,
  flexShrink: 0,
};

const AXIS = {
  tick: { fill: "rgba(255,255,255,0.28)", fontSize: 10 },
  axisLine: { stroke: "rgba(255,255,255,0.08)" },
  tickLine: false as const,
};

const TOOLTIP = {
  contentStyle: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  labelStyle: { color: "rgba(255,255,255,0.4)", marginBottom: 4 },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

const SCENARIO_COLORS: Record<string, string> = {
  "resting limit": "#58a6ff",
  "aggressive limit": "#3fb950",
  cancel: "#d2a8ff",
  "mixed (60/30/10)": "#ffa657",
  "mkt sweep  3 levels": "#79c0ff",
  "mkt sweep 10 levels": "#f78166",
  "mkt sweep 20 levels": "#ff7b72",
};

const SHORT: Record<string, string> = {
  "resting limit": "Resting",
  "aggressive limit": "Aggressive",
  cancel: "Cancel",
  "mixed (60/30/10)": "Mixed",
  "mkt sweep  3 levels": "Sweep 3L",
  "mkt sweep 10 levels": "Sweep 10L",
  "mkt sweep 20 levels": "Sweep 20L",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerformanceAnalytics() {
  const [bench, setBench] = useState<BenchmarkData | null>(SEED_DATA);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const runBenchmark = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setFetchError(null);
    fetch(`${SERVER_URL}/benchmark`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<BenchmarkData>;
      })
      .then((json) => {
        setBench(json);
        setFetchError(null);
      })
      .catch((err) => {
        setFetchError(String(err));
        if (!bench) setBench(SEED_DATA); // show seed data if we have nothing yet
      })
      .finally(() => setLoading(false));
  }, [loading, bench]);

  const scenarioNames = useMemo(
    () => (bench ? Object.keys(bench.scenarios) : []),
    [bench],
  );
  const [selected, setSelected] = useState<string>("");
  const safeSelected = scenarioNames.includes(selected)
    ? selected
    : (scenarioNames[0] ?? "");
  const sc = bench?.scenarios[safeSelected] ?? null;

  // Bar chart data: all scenarios × {p50, p90, p99}
  const comparisonData = useMemo(
    () =>
      scenarioNames.map((name) => ({
        name: SHORT[name] ?? name,
        p50: bench?.scenarios[name].p50_us ?? 0,
        p90: bench?.scenarios[name].p90_us ?? 0,
        p99: bench?.scenarios[name].p99_us ?? 0,
      })),
    [bench, scenarioNames],
  );

  // Tail ratio: p99 / p50 per scenario
  const tailData = useMemo(
    () =>
      scenarioNames.map((name) => {
        const s = bench?.scenarios[name];
        return {
          name: SHORT[name] ?? name,
          ratio: s ? +(s.p99_us / s.p50_us).toFixed(2) : 0,
          max: s ? +s.max_us.toFixed(3) : 0,
        };
      }),
    [bench, scenarioNames],
  );

  const statItems = sc
    ? [
        { label: "Avg", value: sc.avg_us, color: "#79c0ff" },
        { label: "P50", value: sc.p50_us, color: "#3fb950" },
        { label: "P90", value: sc.p90_us, color: "#ffa657" },
        { label: "P99", value: sc.p99_us, color: "#f78166" },
        { label: "Max", value: sc.max_us, color: "rgb(248,113,113)" },
        {
          label: "n",
          value: sc.n,
          color: "rgba(255,255,255,0.4)",
          noUnit: true,
        },
      ]
    : [];

  return (
    <div
      style={{
        height: "100vh",
        background: "#000",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {/* Shared header */}
      <div style={{ height: 48, flexShrink: 0 }}>
        <Header />
      </div>
      {/* Page content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 16px 16px",
        }}
      >
        {/* Everything below only renders once we have data */}
        {
          bench && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Toolbar: scenario tabs left, status + button right */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 16,
                  flexShrink: 0,
                }}
              >
                {scenarioNames.map((name) => {
                  const active = name === safeSelected;
                  return (
                    <button
                      key={name}
                      onClick={() => setSelected(name)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: `1px solid ${active ? (SCENARIO_COLORS[name] ?? "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.1)"}`,
                        background: active
                          ? `${SCENARIO_COLORS[name] ?? "#58a6ff"}18`
                          : "transparent",
                        color: active
                          ? (SCENARIO_COLORS[name] ?? "rgba(255,255,255,0.85)")
                          : "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        letterSpacing: "0.02em",
                        transition: "all 0.15s",
                      }}
                    >
                      {SHORT[name] ?? name}
                    </button>
                  );
                })}

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#ffa657",
                          boxShadow: "0 0 6px rgba(255,166,87,0.7)",
                          animation: "pulse 1.2s ease-in-out infinite",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        Running benchmark…
                      </span>
                    </div>
                  )}
                  {!loading && !fetchError && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "rgb(34,197,94)",
                          boxShadow: "0 0 6px rgba(34,197,94,0.5)",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                        Seed data
                      </span>
                    </div>
                  )}
                  {fetchError && (
                    <span style={{ fontSize: 11, color: "rgb(248,113,113)" }}>
                      {fetchError}
                    </span>
                  )}
                  <button
                    onClick={runBenchmark}
                    disabled={loading}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 7,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: loading
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(88,166,255,0.1)",
                      color: loading ? "rgba(255,255,255,0.25)" : "#58a6ff",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {loading ? "Running…" : "Run Benchmark"}
                  </button>
                </div>
              </div>

              {/* 2×2 chart grid + bottom metrics row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "1fr 1fr 1fr",
                  gap: 12,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* ── Card 1: p50 / p90 / p99 comparison across all scenarios ── */}
                <div style={CARD}>
                  <div style={LABEL}>Latency by percentile — all scenarios</div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} barCategoryGap="28%">
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          {...AXIS}
                          interval={0}
                          tick={{ ...AXIS.tick, fontSize: 9 }}
                        />
                        <YAxis {...AXIS} unit=" µs" width={46} />
                        <Tooltip
                          {...TOOLTIP}
                          formatter={(v) => [`${Number(v).toFixed(3)} µs`]}
                        />
                        <Legend
                          iconType="square"
                          iconSize={8}
                          wrapperStyle={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.4)",
                            paddingTop: 6,
                          }}
                        />
                        <Bar
                          dataKey="p50"
                          name="p50"
                          fill="#3fb950"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="p90"
                          name="p90"
                          fill="#ffa657"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="p99"
                          name="p99"
                          fill="#f78166"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Card 2: Percentile curve for selected scenario ── */}
                <div style={CARD}>
                  <div style={LABEL}>
                    Percentile curve — {SHORT[safeSelected] ?? safeSelected}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sc?.percentile_curve ?? []}>
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="p"
                          {...AXIS}
                          tickFormatter={(v) => `p${v}`}
                          interval={0}
                          tick={{ ...AXIS.tick, fontSize: 9 }}
                        />
                        <YAxis {...AXIS} unit=" µs" width={46} />
                        <Tooltip
                          {...TOOLTIP}
                          formatter={(v) => [
                            `${Number(v).toFixed(3)} µs`,
                            "latency",
                          ]}
                          labelFormatter={(l) => `p${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value_us"
                          stroke={SCENARIO_COLORS[safeSelected] ?? "#58a6ff"}
                          strokeWidth={2}
                          dot={{
                            r: 3,
                            fill: SCENARIO_COLORS[safeSelected] ?? "#58a6ff",
                            strokeWidth: 0,
                          }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Card 3: Histogram for selected scenario ── */}
                <div style={CARD}>
                  <div style={LABEL}>
                    Latency histogram — {SHORT[safeSelected] ?? safeSelected}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sc?.histogram ?? []} barCategoryGap="12%">
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="le_us"
                          {...AXIS}
                          tick={{ ...AXIS.tick, fontSize: 9 }}
                          label={{
                            value: "≤ µs",
                            position: "insideBottomRight",
                            offset: -4,
                            style: {
                              fill: "rgba(255,255,255,0.2)",
                              fontSize: 9,
                            },
                          }}
                        />
                        <YAxis {...AXIS} width={46} />
                        <Tooltip
                          {...TOOLTIP}
                          formatter={(v) => [
                            Number(v).toLocaleString(),
                            "count",
                          ]}
                          labelFormatter={(l) => `≤ ${l} µs`}
                        />
                        <Bar
                          dataKey="count"
                          fill={SCENARIO_COLORS[safeSelected] ?? "#58a6ff"}
                          fillOpacity={0.75}
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Card 4 (moved): Tail spike ratio (p99 / p50) ── */}
                <div style={CARD}>
                  <div style={LABEL}>Tail spike ratio — p99 ÷ p50</div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tailData}
                        layout="vertical"
                        barCategoryGap="20%"
                      >
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          {...AXIS}
                          tickFormatter={(v) => `${v}×`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          {...AXIS}
                          width={58}
                          tick={{ ...AXIS.tick, fontSize: 9 }}
                        />
                        <Tooltip
                          {...TOOLTIP}
                          formatter={(v) => [`${Number(v)}×`, "p99 / p50"]}
                        />
                        <Bar
                          dataKey="ratio"
                          radius={[0, 3, 3, 0]}
                          shape={(props: any) => {
                            const color =
                              props.ratio < 2
                                ? "#3fb950"
                                : props.ratio < 5
                                  ? "#ffa657"
                                  : "#f78166";
                            return (
                              <rect
                                x={props.x}
                                y={props.y}
                                width={props.width}
                                height={props.height}
                                fill={color}
                                rx={3}
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Card 5: Key stats for selected scenario ── */}
                <div style={CARD}>
                  <div style={LABEL}>
                    Key metrics — {SHORT[safeSelected] ?? safeSelected}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    {statItems.map(({ label, value, color, noUnit }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.28)",
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            marginBottom: 5,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 26,
                            fontWeight: 700,
                            color,
                            fontVariantNumeric: "tabular-nums",
                            letterSpacing: "-0.02em",
                            lineHeight: 1,
                          }}
                        >
                          {noUnit
                            ? typeof value === "number"
                              ? value.toLocaleString()
                              : value
                            : typeof value === "number"
                              ? value.toFixed(3)
                              : value}
                        </div>
                        {!noUnit && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.2)",
                              marginTop: 4,
                            }}
                          >
                            µs
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Card 6: Summary table — all scenarios ── */}
                <div style={CARD}>
                  <div style={LABEL}>Summary — all scenarios</div>
                  <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                    <table
                      style={{
                        width: "100%",
                        height: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                      }}
                    >
                      <thead>
                        <tr>
                          {["Scenario", "Avg", "P50", "P90", "P99", "Max"].map(
                            (h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign:
                                    h === "Scenario" ? "left" : "right",
                                  padding: "0 10px 6px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  letterSpacing: "0.07em",
                                  textTransform: "uppercase",
                                  color: "rgba(255,255,255,0.25)",
                                  borderBottom:
                                    "1px solid rgba(255,255,255,0.06)",
                                  whiteSpace: "nowrap",
                                  width: h === "Scenario" ? "auto" : "14%",
                                }}
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {scenarioNames.map((name) => {
                          const s = bench.scenarios[name];
                          const isSelected = name === safeSelected;
                          return (
                            <tr
                              key={name}
                              onClick={() => setSelected(name)}
                              style={{
                                background: isSelected
                                  ? `${SCENARIO_COLORS[name] ?? "#58a6ff"}10`
                                  : "transparent",
                                cursor: "pointer",
                                transition: "background 0.1s",
                              }}
                            >
                              <td
                                style={{
                                  padding: "0 10px",
                                  borderBottom:
                                    "1px solid rgba(255,255,255,0.04)",
                                }}
                              >
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background:
                                      SCENARIO_COLORS[name] ?? "#58a6ff",
                                    display: "inline-block",
                                    marginRight: 7,
                                    verticalAlign: "middle",
                                  }}
                                />
                                <span
                                  style={{
                                    color: isSelected
                                      ? "rgba(255,255,255,0.85)"
                                      : "rgba(255,255,255,0.5)",
                                    fontSize: 13,
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {SHORT[name] ?? name}
                                </span>
                              </td>
                              {[
                                s.avg_us,
                                s.p50_us,
                                s.p90_us,
                                s.p99_us,
                                s.max_us,
                              ].map((v, i) => (
                                <td
                                  key={i}
                                  style={{
                                    padding: "0 10px",
                                    textAlign: "right",
                                    borderBottom:
                                      "1px solid rgba(255,255,255,0.04)",
                                    fontVariantNumeric: "tabular-nums",
                                    color: "rgba(255,255,255,0.6)",
                                    fontSize: 13,
                                  }}
                                >
                                  {v.toFixed(3)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) /* end bench && */
        }
      </div>{" "}
      {/* end page content */}
    </div>
  );
}
