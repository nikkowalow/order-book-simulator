import { ReactNode, useEffect, useState } from "react";
import { SERVER_URL } from "../config/config";
import { useWebSocket } from "../context/WebSocketContext";
import { useNow } from "../hooks/useNow";
import { useAnalyticsStore } from "../stores/analyticsStore";
import { useFeedStore } from "../stores/feedStore";
import { T } from "../theme";

const POLL_MS = 5000;
const SPINNER = ["|", "/", "-", "\\"];

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "0 8px",
        borderRight: `1px solid ${T.line}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: T.amber }}>{label}</span>
      {children}
    </span>
  );
}

function hms(ms: number) {
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

// Server reachability + market maker state, polled. /health doesn't send CORS
// headers, so the market maker status call doubles as the reachability check.
function useServerStatus() {
  const [health, setHealth] = useState<boolean | null>(null);
  const [mm, setMm] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/market_maker/status`);
        const data = await res.json();
        if (cancelled) return;
        setHealth(res.ok);
        setMm(Boolean(data.running));
      } catch {
        if (cancelled) return;
        setHealth(false);
        setMm(null);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { health, mm };
}

export default function StatusBar() {
  const now = useNow(250);
  const { userId, book, orders } = useWebSocket();
  const { status, reconnects, connectedAt, msgTotal, msgRate, rx, lastMsgAt } =
    useFeedStore();
  const latencies = useAnalyticsStore((s) => s.latencies);
  const { health, mm } = useServerStatus();

  const lastRtt = latencies.length ? latencies[latencies.length - 1] : null;
  const age = lastMsgAt ? (now - lastMsgAt) / 1000 : null;
  const ageColor = age == null ? T.mute : age < 5 ? T.text : age < 30 ? T.amber : T.mute;

  const feedColor =
    status === "live" ? T.up : status === "connecting" ? T.yellow : T.down;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "#0a0a0a",
        borderTop: `1px solid ${T.amberDim}`,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.03em",
        color: T.text,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          background: status === "live" ? T.up : T.down,
          color: "#000",
          fontWeight: 700,
        }}
        className={status === "live" ? undefined : "blink"}
      >
        {status === "live" ? "ONLINE" : status === "connecting" ? "DIALING" : "OFFLINE"}
      </span>

      <Item label="WS">
        <span style={{ color: feedColor }}>{status.toUpperCase()}</span>
        <span style={{ color: T.dim }}>RC {reconnects}</span>
      </Item>

      <Item label="RX">
        <span className={rx ? "led" : "led off"} style={{ color: T.up }} />
        <span style={{ color: T.cyan, width: 8 }}>{SPINNER[msgTotal % 4]}</span>
      </Item>

      <Item label="MSG/S">
        <span style={{ color: msgRate > 0 ? T.up : T.dim }}>{msgRate}</span>
      </Item>

      <Item label="MSGS">{msgTotal.toLocaleString()}</Item>

      <Item label="LAST">
        <span style={{ color: ageColor }}>
          {age == null ? "—" : age < 60 ? `${age.toFixed(1)}S` : hms(age * 1000)}
        </span>
        {age != null && age >= 30 && <span style={{ color: T.mute }}>IDLE</span>}
      </Item>

      <Item label="RTT">
        <span style={{ color: T.cyan }}>
          {lastRtt == null ? "—" : `${lastRtt.toFixed(2)}MS`}
        </span>
      </Item>

      <Item label="SRV">
        <span
          className={health === false ? "blink-fast" : undefined}
          style={{ color: health == null ? T.dim : health ? T.up : T.down }}
        >
          {health == null ? "…" : health ? "OK" : "ERR"}
        </span>
      </Item>

      <Item label="MM">
        <span style={{ color: mm ? T.up : T.dim }}>
          {mm == null ? "—" : mm ? "RUNNING" : "HALTED"}
        </span>
      </Item>

      <Item label="LVLS">
        <span style={{ color: T.up }}>{book?.bids.length ?? 0}</span>
        <span style={{ color: T.dim }}>/</span>
        <span style={{ color: T.down }}>{book?.asks.length ?? 0}</span>
      </Item>

      <Item label="OPEN ORD">{orders?.length ?? "—"}</Item>

      <Item label="SESS">
        <span style={{ color: T.yellow }}>{userId ?? "—"}</span>
      </Item>

      <span
        style={{
          marginLeft: "auto",
          padding: "0 8px",
          color: T.dim,
          whiteSpace: "nowrap",
        }}
      >
        CONN{" "}
        <span style={{ color: T.text }}>
          {connectedAt ? hms(now - connectedAt) : "--:--:--"}
        </span>
      </span>
    </div>
  );
}
