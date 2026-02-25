import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
  useState,
} from "react";
import { WS_URL } from "../config/config";
import { Book, RestingOrder, Trade } from "../types/types";

const SESSION_KEY = "obs_userId";

interface WebSocketContextValue {
  send: (message: object) => Promise<any>;
  userId: number | null;
  book: Book | null;
  trades: Trade[];
  orders: RestingOrder[] | null;
}
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orders, setOrders] = useState<RestingOrder[] | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const pending = useRef(
    new Map<
      string,
      {
        resolve: (value: any) => void;
        reject: (err: any) => void;
        t0: number;
      }
    >(),
  );

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      // Append stored userId as query param so the server can reclaim the session.
      const stored = localStorage.getItem(SESSION_KEY);
      const url = stored ? `${WS_URL}?userId=${stored}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Handle session assignment from server
        if (msg.type === "session" && msg.userId) {
          setUserId(msg.userId);
          localStorage.setItem(SESSION_KEY, String(msg.userId));
          console.log(
            msg.reconnected ? "Session resumed" : "Session assigned",
            "userId:",
            msg.userId,
          );
          return;
        }

        // Match pending request/response by requestId
        const { requestId } = msg;
        const entry = pending.current.get(requestId);
        if (entry) {
          const rtt = performance.now() - entry.t0;
          entry.resolve({ msg, rtt });
          pending.current.delete(requestId);
          return;
        }

        if (msg.type === "book_snapshot" || msg.type === "book_update") {
          console.log("Received book update via WSocket", msg.payload);
          setBook(msg.payload);
          return;
        }

        if (msg.type === "trade") {
          console.log("Received trade via WS", msg.payload);
          setTrades((prev) => [msg.payload, ...prev].slice(0, 200));
          return;
        }

        if (msg.type === "orders_update") {
          console.log("Received orders update via WS", msg.payload);
          setOrders(msg.payload);
          return;
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
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

  const send = useCallback((message: object) => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const requestId = crypto.randomUUID();
      const payload = { ...message, requestId };

      pending.current.set(requestId, {
        resolve,
        reject,
        t0: performance.now(),
      });

      wsRef.current.send(JSON.stringify(payload));
    });
  }, []);

  return (
    <WebSocketContext.Provider value={{ send, userId, book, trades, orders }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
}
