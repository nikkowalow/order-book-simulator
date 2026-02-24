import React, { useEffect, useState, useCallback } from "react";
import { SERVER_URL } from "../config/config";

interface UserInfo {
  id: string;
  pnl: number;
  trades: number;
  order_count: number;
}

interface BookStats {
  best_bid: number | null;
  best_ask: number | null;
  bid_levels: number;
  ask_levels: number;
}

const POLL_MS = 2000;

const card: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "18px 20px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.3)",
  marginBottom: 14,
};

export default function AdminPage() {
  const [mmRunning, setMmRunning] = useState<boolean | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [health, setHealth] = useState<"ok" | "error" | "loading">("loading");
  const [bookStats, setBookStats] = useState<BookStats | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/health`);
      //   console.log("Health check response:", res);
      setHealth(res.ok ? "ok" : "error");
    } catch {
      setHealth("error");
    }
  }, []);

  const fetchMmStatus = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/market_maker/status`);
      const data = await res.json();
      setMmRunning(data.running);
    } catch {
      setMmRunning(null);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/book`);
      const data = await res.json();
      const bids: number[][] = data.bids ?? [];
      const asks: number[][] = data.asks ?? [];
      setBookStats({
        best_bid: bids.length > 0 ? bids[0][0] : null,
        best_ask: asks.length > 0 ? asks[0][0] : null,
        bid_levels: bids.length,
        ask_levels: asks.length,
      });
    } catch {
      setBookStats(null);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchMmStatus();
    fetchUsers();
    fetchBook();

    const id = setInterval(() => {
      fetchHealth();
      fetchMmStatus();
      fetchUsers();
      fetchBook();
    }, POLL_MS);

    return () => clearInterval(id);
  }, [fetchHealth, fetchMmStatus, fetchUsers, fetchBook]);

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
        minHeight: "100vh",
        background: "#000",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <a
          href="/"
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 13,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            transition: "color 0.15s",
          }}
        >
          ← Back
        </a>
        <span
          style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.02em" }}
        >
          Admin
        </span>

        {/* Health indicator */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                health === "ok"
                  ? "rgb(34,197,94)"
                  : health === "error"
                    ? "rgb(239,68,68)"
                    : "rgba(255,255,255,0.2)",
              boxShadow:
                health === "ok"
                  ? "0 0 6px rgba(34,197,94,0.6)"
                  : health === "error"
                    ? "0 0 6px rgba(239,68,68,0.5)"
                    : "none",
            }}
          />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            {health === "ok"
              ? "Server online"
              : health === "error"
                ? "Server offline"
                : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Top row: Market Maker + Book Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {/* Market Maker */}
        <div style={card}>
          <div style={sectionLabel}>Market Maker</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    mmRunning === true
                      ? "rgb(34,197,94)"
                      : mmRunning === false
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(255,255,255,0.1)",
                  boxShadow:
                    mmRunning === true ? "0 0 6px rgba(34,197,94,0.6)" : "none",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color:
                    mmRunning === true
                      ? "rgb(34,197,94)"
                      : "rgba(255,255,255,0.3)",
                }}
              >
                {mmRunning === null ? "—" : mmRunning ? "Running" : "Stopped"}
              </span>
            </div>
            <button
              onClick={toggleMm}
              disabled={mmLoading || mmRunning === null}
              style={{
                padding: "8px 20px",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor:
                  mmLoading || mmRunning === null ? "not-allowed" : "pointer",
                background: mmRunning
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(34,197,94,0.12)",
                color: mmRunning ? "rgb(248,113,113)" : "rgb(74,222,128)",
                letterSpacing: "0.04em",
                opacity: mmLoading || mmRunning === null ? 0.5 : 1,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {mmLoading ? "..." : mmRunning ? "STOP" : "START"}
            </button>
          </div>
        </div>

        {/* Book stats */}
        <div style={card}>
          <div style={sectionLabel}>Order Book</div>
          <div style={{ display: "flex", gap: 28 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                BEST BID
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgb(74,222,128)",
                }}
              >
                {bookStats?.best_bid ?? "—"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                BEST ASK
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgb(248,113,113)",
                }}
              >
                {bookStats?.best_ask ?? "—"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                SPREAD
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {spread ?? "—"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                MID
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {mid ?? "—"}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 4,
                }}
              >
                LEVELS
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "rgb(74,222,128)" }}>
                  {bookStats?.bid_levels ?? 0}
                </span>
                {" / "}
                <span style={{ color: "rgb(248,113,113)" }}>
                  {bookStats?.ask_levels ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div style={card}>
        <div
          style={{
            ...sectionLabel,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Connected Users</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {users.length} total
          </span>
        </div>

        {users.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "rgba(255,255,255,0.2)",
              fontSize: 13,
            }}
          >
            No users connected
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {["User ID", "Trades", "Open Orders", "P&L"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "User ID" ? "left" : "right",
                      padding: "6px 12px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.28)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    background:
                      i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <td
                    style={{
                      padding: "9px 12px",
                      fontFamily: "monospace",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {u.id}
                  </td>
                  <td
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {u.trades}
                  </td>
                  <td
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {u.order_count}
                  </td>
                  <td
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color:
                        u.pnl > 0
                          ? "rgb(74,222,128)"
                          : u.pnl < 0
                            ? "rgb(248,113,113)"
                            : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {u.pnl > 0 ? "+" : ""}
                    {u.pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
