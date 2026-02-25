import { useWebSocket } from "../context/WebSocketContext";
import { usePosition } from "../hooks/usePosition";

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function BalanceStrip() {
  const { userId } = useWebSocket();
  const position = usePosition(userId);

  if (position == null) return null;

  const availBalance = position.balance - position.reservedBalance;
  const availShares = position.shares - position.reservedShares;

  const tiles = [
    {
      label: "BALANCE",
      value: `$${fmt(availBalance)}`,
      color: availBalance >= 0 ? "rgba(255,255,255,0.85)" : "rgb(248,113,113)",
    },
    {
      label: "RSVD $",
      value: `$${fmt(position.reservedBalance)}`,
      color:
        position.reservedBalance > 0
          ? "rgb(250,204,21)"
          : "rgba(255,255,255,0.25)",
    },
    {
      label: "SHARES",
      value: fmt(availShares),
      color: availShares >= 0 ? "rgb(74,222,128)" : "rgb(248,113,113)",
    },
    {
      label: "RSVD SHR",
      value: fmt(position.reservedShares),
      color:
        position.reservedShares > 0
          ? "rgb(250,204,21)"
          : "rgba(255,255,255,0.25)",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {tiles.map(({ label, value, color }, i) => (
        <div
          key={label}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRight:
              i < tiles.length - 1
                ? "1px solid rgba(255,255,255,0.06)"
                : undefined,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.28)",
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
