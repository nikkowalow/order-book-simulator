import { useWebSocket } from "../context/WebSocketContext";
import { usePosition } from "../hooks/usePosition";
import Flash from "./Flash";
import { T, fmt } from "../theme";

export default function BalanceStrip() {
  const { userId } = useWebSocket();
  const position = usePosition(userId);

  const availBalance = position ? position.balance - position.reservedBalance : null;
  const availShares = position ? position.shares - position.reservedShares : null;

  const tiles = [
    {
      label: "CASH",
      raw: availBalance,
      value: availBalance == null ? "—" : `$${fmt(availBalance)}`,
      color: availBalance != null && availBalance < 0 ? T.down : T.text,
    },
    {
      label: "RSVD $",
      raw: position?.reservedBalance ?? null,
      value: position ? `$${fmt(position.reservedBalance)}` : "—",
      color: position?.reservedBalance ? T.yellow : T.mute,
    },
    {
      label: "SHARES",
      raw: availShares,
      value: availShares == null ? "—" : fmt(availShares),
      color: availShares != null && availShares < 0 ? T.down : T.up,
    },
    {
      label: "RSVD SH",
      raw: position?.reservedShares ?? null,
      value: position ? fmt(position.reservedShares) : "—",
      color: position?.reservedShares ? T.yellow : T.mute,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderBottom: `1px solid ${T.line}`,
        background: "#0a0a0a",
      }}
    >
      {tiles.map(({ label, raw, value, color }, i) => (
        <div
          key={label}
          style={{
            padding: "3px 6px",
            borderRight: i < tiles.length - 1 ? `1px solid ${T.line}` : undefined,
            minWidth: 0,
          }}
        >
          <div className="t-label" style={{ fontSize: 12 }}>
            {label}
          </div>
          <Flash value={raw} style={{ fontSize: 15, fontWeight: 700, color }}>
            {value}
          </Flash>
        </div>
      ))}
    </div>
  );
}
