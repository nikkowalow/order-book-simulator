import { useEffect, useRef, useState, useCallback } from "react";
import { Trade } from "../types/types";
import { SERVER_URL } from "../config/config";

const WS_URL = "ws://localhost:9001";
const MAX_TRADES = 200;

export function useTradeSocket() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [bookVersion, setBookVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial fetch of trade history
  useEffect(() => {
    fetch(`${SERVER_URL}/trades?limit=100`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: Trade[]) => setTrades(data))
      .catch(() => {});
  }, []);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const trade = JSON.parse(ev.data) as Trade;
          setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
          setBookVersion((v) => v + 1);
        } catch {}
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { trades, bookVersion };
}
