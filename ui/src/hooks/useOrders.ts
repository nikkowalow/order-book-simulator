import { useEffect, useRef, useState } from "react";
import { RestingOrder } from "../types/types";

const WS_URL = "ws://localhost:9001";
const HTTP_URL = "http://localhost:8080";

export function useOrders() {
  const [orders, setOrders] = useState<RestingOrder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchOrders = () => {
    fetch(`${HTTP_URL}/orders`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: RestingOrder[]) => {
        setOrders(data);
        setErr(null);
      })
      .catch((e) => setErr(e?.message ?? "Failed to fetch /orders"));
  };

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    // Initial fetch
    fetchOrders();

    // Subscribe to book changes via WebSocket and refetch orders
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = () => {
        // Book changed, refetch orders
        fetchOrders();
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

  return { orders, err };
}
