#!/usr/bin/env python3
"""
bench_plot.py — visualise order-book benchmark results from bench_results.csv

Usage:
    python3 bench_plot.py [bench_results.csv] [output.png]
"""

import sys
import pathlib
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
from matplotlib.gridspec import GridSpec

matplotlib.rcParams.update({
    "figure.facecolor":  "#0f1117",
    "axes.facecolor":    "#161b22",
    "axes.edgecolor":    "#30363d",
    "axes.labelcolor":   "#c9d1d9",
    "axes.titlecolor":   "#c9d1d9",
    "axes.grid":         True,
    "grid.color":        "#21262d",
    "grid.linewidth":    0.6,
    "text.color":        "#c9d1d9",
    "xtick.color":       "#8b949e",
    "ytick.color":       "#8b949e",
    "xtick.labelsize":   8,
    "ytick.labelsize":   8,
    "axes.titlesize":    10,
    "axes.labelsize":    9,
    "legend.facecolor":  "#161b22",
    "legend.edgecolor":  "#30363d",
    "legend.fontsize":   8,
    "font.family":       "monospace",
})

ACCENT_COLORS = [
    "#58a6ff", "#3fb950", "#f78166", "#d2a8ff",
    "#ffa657", "#79c0ff", "#56d364", "#ff7b72",
]

# ---------------------------------------------------------------------------

def load(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df.columns = ["scenario", "latency_us"]
    return df


def summary_stats(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for scenario, grp in df.groupby("scenario", sort=False):
        v = grp["latency_us"].values
        rows.append({
            "Scenario":  scenario,
            "n":         len(v),
            "avg (µs)":  f"{np.mean(v):.3f}",
            "p50 (µs)":  f"{np.percentile(v, 50):.3f}",
            "p90 (µs)":  f"{np.percentile(v, 90):.3f}",
            "p99 (µs)":  f"{np.percentile(v, 99):.3f}",
            "max (µs)":  f"{np.max(v):.3f}",
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Subplots
# ---------------------------------------------------------------------------

def plot_cdf(ax, df, scenarios, colors):
    """Full CDF zoomed to p99.9."""
    global_max = 0
    for sc, color in zip(scenarios, colors):
        v = np.sort(df.loc[df["scenario"] == sc, "latency_us"].values)
        cdf = np.arange(1, len(v) + 1) / len(v)
        ax.plot(v, cdf, linewidth=1.4, color=color, label=sc)
        global_max = max(global_max, np.percentile(v, 99))
    ax.set_xlim(0, global_max)
    ax.set_ylim(0, 1.02)
    ax.set_xlabel("Latency (µs)")
    ax.set_ylabel("CDF")
    ax.set_title("CDF (zoomed to p99.9)")
    ax.legend(loc="lower right")


def plot_percentile_curve(ax, df, scenarios, colors):
    """Latency vs percentile from p50 to p99.99 on a log x-axis."""
    percentiles = np.linspace(50, 99.9, 500)
    for sc, color in zip(scenarios, colors):
        v = df.loc[df["scenario"] == sc, "latency_us"].values
        lat = np.percentile(v, percentiles)
        ax.plot(percentiles, lat, linewidth=1.4, color=color, label=sc)
    ax.set_xlabel("Percentile")
    ax.set_ylabel("Latency (µs)")
    ax.set_title("Percentile Curve (p50 → p99.99)")
    ax.set_xlim(50, 99.99)
    ax.xaxis.set_major_formatter(ticker.FormatStrFormatter("p%.2f"))
    ax.xaxis.set_major_locator(ticker.MultipleLocator(10))
    ax.legend(loc="upper left")


def plot_latency_vs_index(ax, df, scenarios, colors):
    """Latency vs index with extreme tail filtered (above p99.9 removed)."""

    STRIDE = max(1, len(df.loc[df["scenario"] == scenarios[0]]) // 2000)

    for sc, color in zip(scenarios, colors):
        v = df.loc[df["scenario"] == sc, "latency_us"].values
        idx = np.arange(len(v))

        # compute cutoff
        cutoff = np.percentile(v, 99.9)

        # mask out extreme spikes
        mask = v <= cutoff

        ax.plot(idx[mask][::STRIDE],
                v[mask][::STRIDE],
                linewidth=0.6,
                alpha=0.8,
                color=color,
                label=sc)

    ax.set_xlabel("Order index")
    ax.set_ylabel("Latency (µs)")
    ax.set_title("Latency vs Order Index (≤ p99.9)")
    ax.legend(loc="upper right")


def plot_tail_zoom(ax, df, scenarios, colors):
    """CDF from p99 to p100 — tail behaviour only."""
    for sc, color in zip(scenarios, colors):
        v = np.sort(df.loc[df["scenario"] == sc, "latency_us"].values)
        cdf = np.arange(1, len(v) + 1) / len(v)
        mask = cdf >= 0.99
        ax.plot(v[mask], cdf[mask], linewidth=1.4, color=color, label=sc)
    ax.set_xlabel("Latency (µs)")
    ax.set_ylabel("CDF")
    ax.set_title("Tail Zoom (p99 → p100)")
    ax.yaxis.set_major_formatter(ticker.PercentFormatter(xmax=1, decimals=2))
    ax.legend(loc="lower right")


def plot_percentile_bars(ax, summary, colors):
    """Side-by-side bar chart of avg / p50 / p90 / p99 per scenario."""
    x     = np.arange(len(summary))
    width = 0.18
    avg = summary["avg (µs)"].astype(float).values
    p50 = summary["p50 (µs)"].astype(float).values
    p90 = summary["p90 (µs)"].astype(float).values
    p99 = summary["p99 (µs)"].astype(float).values

    offsets = [-1.5, -0.5, 0.5, 1.5]
    bars_avg = ax.bar(x + offsets[0] * width, avg, width, label="avg", color="#79c0ff", alpha=0.85)
    bars50   = ax.bar(x + offsets[1] * width, p50, width, label="p50", color="#3fb950", alpha=0.85)
    bars90   = ax.bar(x + offsets[2] * width, p90, width, label="p90", color="#ffa657", alpha=0.85)
    bars99   = ax.bar(x + offsets[3] * width, p99, width, label="p99", color="#f78166", alpha=0.85)

    for bars in (bars_avg, bars50, bars90, bars99):
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.02,
                    f"{h:.2f}", ha="center", va="bottom", fontsize=6, color="#8b949e")

    ax.set_xticks(x)
    ax.set_xticklabels(summary["Scenario"].values, rotation=22, ha="right", fontsize=7.5)
    ax.set_ylabel("Latency (µs)")
    ax.set_title("avg / p50 / p90 / p99 by Scenario")
    ax.legend()


def plot_violin(ax, df, scenarios, colors):
    data    = [df.loc[df["scenario"] == sc, "latency_us"].values for sc in scenarios]
    clipped = [np.clip(d, 0, np.percentile(d, 99)) for d in data]

    parts = ax.violinplot(clipped, positions=range(len(scenarios)),
                          showmedians=True, showextrema=False)

    for pc, color in zip(parts["bodies"], colors):
        pc.set_facecolor(color)
        pc.set_alpha(0.55)
        pc.set_edgecolor(color)

    parts["cmedians"].set_color("#ffffff")
    parts["cmedians"].set_linewidth(1.4)

    ax.set_xticks(range(len(scenarios)))
    ax.set_xticklabels(scenarios, rotation=22, ha="right", fontsize=7.5)
    ax.set_ylabel("Latency (µs, clipped at p90)")
    ax.set_title("Distribution (violin)")


def plot_table(ax, summary):
    ax.axis("off")
    cols = list(summary.columns)
    rows = summary.values.tolist()

    tbl = ax.table(cellText=rows, colLabels=cols, loc="center", cellLoc="center")
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(8)
    tbl.scale(1, 1.6)

    for j in range(len(cols)):
        cell = tbl[0, j]
        cell.set_facecolor("#21262d")
        cell.set_text_props(color="#c9d1d9", fontweight="bold")

    for i in range(1, len(rows) + 1):
        for j in range(len(cols)):
            cell = tbl[i, j]
            cell.set_facecolor("#161b22" if i % 2 == 0 else "#0d1117")
            cell.set_text_props(color="#c9d1d9")
            cell.set_edgecolor("#30363d")

    ax.set_title("Summary Statistics", pad=12)


# ---------------------------------------------------------------------------

SAVEFIG_KWARGS = dict(dpi=150, bbox_inches="tight")

def save_single(name, plot_fn, out_dir, *args, **kwargs):
    """Render one plot function into its own full-size figure and save it."""
    fig, ax = plt.subplots(figsize=(14, 8))
    fig.patch.set_facecolor("#0f1117")
    plot_fn(ax, *args, **kwargs)
    path = out_dir / f"{name}.png"
    fig.savefig(path, facecolor=fig.get_facecolor(), **SAVEFIG_KWARGS)
    plt.close(fig)
    print(f"  {path}")


def save_table_single(out_dir, summary):
    """Table needs a taller figure to breathe."""
    fig, ax = plt.subplots(figsize=(14, 4))
    fig.patch.set_facecolor("#0f1117")
    plot_table(ax, summary)
    path = out_dir / "bench_table.png"
    fig.savefig(path, facecolor=fig.get_facecolor(), **SAVEFIG_KWARGS)
    plt.close(fig)
    print(f"  {path}")


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "core/bench_output/bench_results.csv"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "core/bench/bench_overview.png"

    if not pathlib.Path(csv_path).exists():
        print(f"Error: {csv_path} not found. Run ./bench first.")
        sys.exit(1)

    out_dir = pathlib.Path(out_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    df        = load(csv_path)
    scenarios = list(dict.fromkeys(df["scenario"]))
    colors    = [ACCENT_COLORS[i % len(ACCENT_COLORS)] for i in range(len(scenarios))]
    summary   = summary_stats(df)

    # ── Overview (all panels in one figure) ─────────────────────────────────
    fig = plt.figure(figsize=(20, 18))
    fig.suptitle("Order Book Matching Engine — Benchmark Report",
                 fontsize=13, fontweight="bold", y=0.99, color="#e6edf3")

    gs = GridSpec(4, 2, figure=fig, hspace=0.55, wspace=0.32,
                  left=0.07, right=0.97, top=0.96, bottom=0.05)

    plot_cdf(             fig.add_subplot(gs[0, 0]), df, scenarios, colors)
    plot_percentile_curve(fig.add_subplot(gs[0, 1]), df, scenarios, colors)
    plot_percentile_bars( fig.add_subplot(gs[1, 0]), summary, colors)
    plot_violin(          fig.add_subplot(gs[1, 1]), df, scenarios, colors)
    plot_latency_vs_index(fig.add_subplot(gs[2, 0]), df, scenarios, colors)
    plot_tail_zoom(       fig.add_subplot(gs[2, 1]), df, scenarios, colors)
    plot_table(           fig.add_subplot(gs[3, :]), summary)

    fig.savefig(out_path, facecolor=fig.get_facecolor(), **SAVEFIG_KWARGS)
    plt.close(fig)
    print(f"Overview saved to: {out_path}")

    # ── Individual full-size exports ─────────────────────────────────────────
    print("Individual panels:")
    save_single("bench_cdf",             plot_cdf,              out_dir, df, scenarios, colors)
    save_single("bench_percentile_curve",plot_percentile_curve, out_dir, df, scenarios, colors)
    save_single("bench_percentile_bars", plot_percentile_bars,  out_dir, summary, colors)
    save_single("bench_violin",          plot_violin,           out_dir, df, scenarios, colors)
    save_single("bench_latency_vs_index",plot_latency_vs_index, out_dir, df, scenarios, colors)
    save_single("bench_tail_zoom",       plot_tail_zoom,        out_dir, df, scenarios, colors)
    save_table_single(out_dir, summary)


if __name__ == "__main__":
    main()
