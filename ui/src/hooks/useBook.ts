import { useEffect, useRef, useState } from "react";
import { Book } from "../types/types";
import { SERVER_URL, WS_URL } from "../config/config";

export function useBook() {
  const [book, setBook] = useState<Book | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    // Initial fetch
    fetch(`${SERVER_URL}/book`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: Book) => setBook(data))
      .catch((e) => setErr(e?.message ?? "Failed to fetch /book"));

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as Book;
          console.log("Received book update via WS", data);
          if (data.bids && data.asks) {
            setBook(data);
            setErr(null);
          }
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

  return { book, err };
}
