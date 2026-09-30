import React, { useEffect, useState, useCallback } from "react";
import { SERVER_URL } from "../config/config";
import Panel, { LiveTag } from "../components/Panel";
import Flash from "../components/Flash";
import { T } from "../theme";
import { Book } from "../types/types";

// /users currently returns bare ids; stats are optional until it sends them.
interface UserInfo {
  id: string;
  pnl?: number;
  trades?: number;
  order_count?: number;
}

interface BookStats {
  best_bid: number | null;
  best_ask: number | null;
  bid_levels: number;
  ask_levels: number;
}

const POLL_MS = 2000;

const cell: React.CSSProperties = {
  padding: "2px 10px",
  textAlign: "right",
  color: T.text,
  borderBottom: `1px solid ${T.lineSoft}`,
};

export default function AdminPage() {
  const [mmRunning, setMmRunning] = useState<boolean | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [health, setHealth] = useState<"ok" | "error" | "loading">("loading");
  const [bookStats, setBookStats] = useState<BookStats | null>(null);

  // /health doesn't send CORS headers, so this call doubles as the health check.
  const fetchMmStatus = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/market_maker/status`);
      const data = await res.json();
      setMmRunning(data.running);
      setHealth(res.ok ? "ok" : "error");
    } catch {
      setMmRunning(null);
      setHealth("error");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/users`);
      const data = await res.json();
      setUsers(
        Array.isArray(data)
          ? data.map((u) => (typeof u === "object" ? u : { id: String(u) }))
          : [],
      );
    } catch {
      setUsers([]);
    }
  }, []);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/book`);
      const data = await res.json();
      const { bids = [], asks = [] }: Partial<Book> = data.payload ?? data;
      setBookStats({
        best_bid: bids[0]?.price ?? null,
        best_ask: asks[0]?.price ?? null,
        bid_levels: bids.length,
        ask_levels: asks.length,
      });
    } catch {
      setBookStats(null);
    }
  }, []);

  useEffect(() => {
    fetchMmStatus();
    fetchUsers();
    fetchBook();

    const id = setInterval(() => {
      fetchMmStatus();
      fetchUsers();
      fetchBook();
    }, POLL_MS);

    return () => clearInterval(id);
  }, [fetchMmStatus, fetchUsers, fetchBook]);

  const toggleMm = async () => {
    setMmLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/market_maker/toggle`, {
        method: "POST",
      });
      const data = await res.json();
      setMmRunning(data.running);
    } catch {
      // ignore
    } finally {
      setMmLoading(false);
    }
  };

  const spread =
    bookStats?.best_bid != null && bookStats?.best_ask != null
      ? bookStats.best_ask - bookStats.best_bid
      : null;

  const mid =
    bookStats?.best_bid != null && bookStats?.best_ask != null
      ? ((bookStats.best_ask + bookStats.best_bid) / 2).toFixed(1)
      : null;

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gridTemplateRows: "auto 1fr",
        gap: 3,
      }}
    >
      {/* Market Maker */}
      <Panel
        code="MM"
        title="Market Maker"
        meta={
          <LiveTag
            label={health === "ok" ? "SRV OK" : health === "error" ? "SRV DOWN" : "SRV …"}
            color={health === "ok" ? T.up : health === "error" ? T.down : T.dim}
            blink={health !== "ok"}
          />
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}>
          <span
            className={mmRunning === true ? "led" : "led off"}
            style={{ color: mmRunning === true ? T.up : T.dim }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 24,
              fontWeight: 700,
              color: mmRunning === true ? T.up : T.dim,
            }}
          >
            {mmRunning === null ? "—" : mmRunning ? "RUNNING" : "HALTED"}
          </span>
          <button
            onClick={toggleMm}
            disabled={mmLoading || mmRunning === null}
            className="t-btn on"
            style={{
              fontSize: 15,
              padding: "3px 14px",
              background: mmRunning ? T.down : T.up,
            }}
          >
            {mmLoading ? "…" : mmRunning ? "STOP <GO>" : "START <GO>"}
          </button>
        </div>
      </Panel>

      {/* Book stats */}
      <Panel code="OB" title="Order Book">
        <div style={{ display: "flex", gap: 24, padding: 10 }}>
          {[
            { label: "Best Bid", value: bookStats?.best_bid, color: T.up },
            { label: "Best Ask", value: bookStats?.best_ask, color: T.down },
            { label: "Spread", value: spread, color: T.yellow },
            { label: "Mid", value: mid, color: T.text },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="t-label" style={{ marginBottom: 4 }}>
                {label}
              </div>
              <Flash value={value} style={{ fontSize: 24, fontWeight: 700, color }}>
                {value ?? "—"}
              </Flash>
            </div>
          ))}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="t-label" style={{ marginBottom: 4 }}>
              Levels
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              <span style={{ color: T.up }}>{bookStats?.bid_levels ?? 0}</span>
              <span style={{ color: T.dim }}> / </span>
              <span style={{ color: T.down }}>{bookStats?.ask_levels ?? 0}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Users table */}
      <div style={{ gridColumn: "1 / 3", minHeight: 0 }}>
        <Panel
          code="US"
          title="Connected Users"
          meta={<span>{users.length} TOTAL</span>}
        >
          {users.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: T.mute }}>
              NO USERS CONNECTED
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr className="t-cols">
                  {["User ID", "Trades", "Open Orders", "P&L"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "User ID" ? "left" : "right",
                        padding: "2px 10px",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="flash-new">
                    <td style={{ ...cell, textAlign: "left", color: T.yellow }}>{u.id}</td>
                    <td style={cell}>{u.trades ?? "—"}</td>
                    <td style={cell}>{u.order_count ?? "—"}</td>
                    <td
                      style={{
                        ...cell,
                        fontWeight: 700,
                        color: !u.pnl ? T.dim : u.pnl > 0 ? T.up : T.down,
                      }}
                    >
                      <Flash value={u.pnl}>
                        {u.pnl == null ? "—" : `${u.pnl > 0 ? "+" : ""}${u.pnl}`}
                      </Flash>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
