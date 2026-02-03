export default function Header() {
  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: "100%",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
        Order Book Simulator
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          Guest
        </span>
        <button
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.8)",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Log In
        </button>
      </div>
    </div>
  );
}
