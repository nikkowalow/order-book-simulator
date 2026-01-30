export function VolumeBar({
  bidVolume,
  askVolume,
}: {
  bidVolume: number;
  askVolume: number;
}) {
  const total = bidVolume + askVolume;
  const bidPct = total > 0 ? (bidVolume / total) * 100 : 50;
  const askPct = total > 0 ? (askVolume / total) * 100 : 50;

  return (
    <div
      style={{
        padding: "8px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 4,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        <span style={{ color: "rgb(34,197,94)" }}>{bidPct.toFixed(1)}%</span>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>
          Volume
        </span>
        <span style={{ color: "rgb(239,68,68)" }}>{askPct.toFixed(1)}%</span>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            width: `${bidPct}%`,
            background: "linear-gradient(90deg, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.9) 100%)",
            transition: "width 200ms ease",
          }}
        />
        <div
          style={{
            width: `${askPct}%`,
            background: "linear-gradient(90deg, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.6) 100%)",
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}
