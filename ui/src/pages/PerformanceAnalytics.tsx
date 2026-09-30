import React, { useCallback, useMemo, useState } from "react";
import Panel, { LiveTag } from "../components/Panel";
import Flash from "../components/Flash";
import { T } from "../theme";
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

const CHART_BODY: React.CSSProperties = { overflow: "hidden", padding: "8px 8px 4px" };

const AXIS = {
  tick: { fill: T.dim, fontSize: 10, fontFamily: T.font },
  axisLine: { stroke: T.line },
  tickLine: false as const,
};

const GRID = { stroke: T.line, strokeDasharray: "1 3" };

const TOOLTIP = {
  contentStyle: {
    background: "#000",
    border: `1px solid ${T.amber}`,
    borderRadius: 0,
    fontSize: 11,
    fontFamily: T.font,
    color: T.text,
  },
  labelStyle: { color: T.amber, marginBottom: 4 },
  cursor: { fill: "rgba(255,158,27,0.08)" },
};

const SCENARIO_COLORS: Record<string, string> = {
  "resting limit": T.cyan,
  "aggressive limit": T.up,
  cancel: T.magenta,
  "mixed (60/30/10)": T.amber,
  "mkt sweep  3 levels": T.yellow,
  "mkt sweep 10 levels": "#ff7a45",
  "mkt sweep 20 levels": T.down,
};

const SHORT: Record<string, string> = {
  "resting limit": "RESTING",
  "aggressive limit": "AGGRESSIVE",
  cancel: "CANCEL",
  "mixed (60/30/10)": "MIXED",
  "mkt sweep  3 levels": "SWEEP 3L",
  "mkt sweep 10 levels": "SWEEP 10L",
  "mkt sweep 20 levels": "SWEEP 20L",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerformanceAnalytics() {
  const [bench, setBench] = useState<BenchmarkData | null>(SEED_DATA);
  const [source, setSource] = useState<"seed" | "live">("seed");
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
        setSource("live");
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
  const scColor = SCENARIO_COLORS[safeSelected] ?? T.cyan;
  const scName = SHORT[safeSelected] ?? safeSelected.toUpperCase();

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
        { label: "Avg", value: sc.avg_us, color: T.cyan },
        { label: "P50", value: sc.p50_us, color: T.up },
        { label: "P90", value: sc.p90_us, color: T.amber },
        { label: "P99", value: sc.p99_us, color: "#ff7a45" },
        { label: "Max", value: sc.max_us, color: T.down },
        { label: "N", value: sc.n, color: T.dim, noUnit: true },
      ]
    : [];

  if (!bench) return null;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Toolbar: scenario keys left, status + run right */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 24,
          paddingRight: 6,
          background: T.panel,
          border: `1px solid ${T.line}`,
        }}
      >
        <span className="panel-code" style={{ fontWeight: 700, marginRight: 6 }}>
          BENCH
        </span>
        <span className="t-label" style={{ marginRight: 4 }}>
          Scenario
        </span>
        {scenarioNames.map((name, i) => (
          <button
            key={name}
            onClick={() => setSelected(name)}
            className={name === safeSelected ? "t-btn on" : "t-btn"}
          >
            {i + 1}) {SHORT[name] ?? name}
          </button>
        ))}

        <div
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}
        >
          {loading ? (
            <span className="blink-fast">
              <LiveTag label="RUNNING BENCHMARK…" color={T.yellow} blink={false} />
            </span>
          ) : fetchError ? (
            <span className="blink" style={{ color: T.down, fontWeight: 700 }}>
              ERR {fetchError.toUpperCase()}
            </span>
          ) : (
            <LiveTag
              label={source === "live" ? "LIVE RESULT" : "SEED DATA"}
              color={source === "live" ? T.up : T.dim}
              blink={false}
            />
          )}
          <button onClick={runBenchmark} disabled={loading} className="t-btn on">
            {loading ? "RUNNING…" : "RUN BENCH <GO>"}
          </button>
        </div>
      </div>

      {/* 2×3 panel grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr 1fr",
          gap: 3,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── G1: p50 / p90 / p99 comparison across all scenarios ── */}
        <Panel code="G1" title="Latency by percentile · all scenarios" meta="µs" bodyStyle={CHART_BODY}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} barCategoryGap="28%">
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis
                dataKey="name"
                {...AXIS}
                interval={0}
                tick={{ ...AXIS.tick, fontSize: 9 }}
              />
              <YAxis {...AXIS} width={40} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [`${Number(v).toFixed(3)} µs`]}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, fontFamily: T.font, color: T.dim, paddingTop: 2 }}
              />
              <Bar dataKey="p50" name="P50" fill={T.up} />
              <Bar dataKey="p90" name="P90" fill={T.amber} />
              <Bar dataKey="p99" name="P99" fill={T.down} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* ── G2: Percentile curve for selected scenario ── */}
        <Panel code="G2" title={`Percentile curve · ${scName}`} meta="µs" bodyStyle={CHART_BODY}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sc?.percentile_curve ?? []}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis
                dataKey="p"
                {...AXIS}
                tickFormatter={(v) => `p${v}`}
                interval={0}
                tick={{ ...AXIS.tick, fontSize: 9 }}
              />
              <YAxis {...AXIS} width={40} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [`${Number(v).toFixed(3)} µs`, "latency"]}
                labelFormatter={(l) => `p${l}`}
              />
              <Line
                type="stepAfter"
                dataKey="value_us"
                stroke={scColor}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: scColor, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* ── G3: Histogram for selected scenario ── */}
        <Panel code="G3" title={`Latency histogram · ${scName}`} meta="≤ µs" bodyStyle={CHART_BODY}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sc?.histogram ?? []} barCategoryGap="12%">
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis
                dataKey="le_us"
                {...AXIS}
                tick={{ ...AXIS.tick, fontSize: 9 }}
              />
              <YAxis {...AXIS} width={40} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [Number(v).toLocaleString(), "count"]}
                labelFormatter={(l) => `≤ ${l} µs`}
              />
              <Bar dataKey="count" fill={scColor} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* ── G4: Tail spike ratio (p99 / p50) ── */}
        <Panel code="G4" title="Tail spike ratio · p99 ÷ p50" bodyStyle={CHART_BODY}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tailData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis type="number" {...AXIS} tickFormatter={(v) => `${v}×`} />
              <YAxis
                type="category"
                dataKey="name"
                {...AXIS}
                width={72}
                tick={{ ...AXIS.tick, fontSize: 9 }}
              />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [`${Number(v)}×`, "p99 / p50"]}
              />
              <Bar
                dataKey="ratio"
                shape={(props: any) => {
                  const color =
                    props.ratio < 2 ? T.up : props.ratio < 5 ? T.amber : T.down;
                  return (
                    <rect
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      fill={color}
                    />
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* ── M1: Key stats for selected scenario ── */}
        <Panel code="M1" title={`Key metrics · ${scName}`} meta="µs">
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              alignItems: "center",
            }}
          >
            {statItems.map(({ label, value, color, noUnit }, i) => (
              <div
                key={label}
                style={{
                  padding: "0 10px",
                  borderLeft: i > 0 ? `1px solid ${T.line}` : undefined,
                }}
              >
                <div className="t-label" style={{ marginBottom: 6 }}>
                  {label}
                </div>
                <Flash
                  value={value}
                  style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}
                >
                  {noUnit ? value.toLocaleString() : value.toFixed(3)}
                </Flash>
                <div style={{ fontSize: 10, color: T.mute, marginTop: 4 }}>
                  {noUnit ? "SAMPLES" : "µs"}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── T1: Summary table — all scenarios ── */}
        <Panel code="T1" title="Summary · all scenarios" meta="µs · CLICK ROW TO SELECT">
          <table
            style={{
              width: "100%",
              height: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              fontSize: 12,
            }}
          >
            <thead>
              <tr className="t-cols">
                {["Scenario", "Avg", "P50", "P90", "P99", "Max"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Scenario" ? "left" : "right",
                      padding: "2px 8px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      width: h === "Scenario" ? "auto" : "14%",
                    }}
                  >
                    {h}
                  </th>
                ))}
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
                      background: isSelected ? T.navy : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <td
                      style={{
                        padding: "0 8px",
                        borderBottom: `1px solid ${T.lineSoft}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          background: SCENARIO_COLORS[name] ?? T.cyan,
                          display: "inline-block",
                          marginRight: 7,
                        }}
                      />
                      <span
                        style={{
                          color: isSelected ? T.text : T.dim,
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        {isSelected ? "► " : ""}
                        {SHORT[name] ?? name}
                      </span>
                    </td>
                    {[s.avg_us, s.p50_us, s.p90_us, s.p99_us, s.max_us].map(
                      (v, i) => (
                        <td
                          key={i}
                          style={{
                            padding: "0 8px",
                            textAlign: "right",
                            borderBottom: `1px solid ${T.lineSoft}`,
                            color: isSelected ? T.text : T.dim,
                          }}
                        >
                          {v.toFixed(3)}
                        </td>
                      ),
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
