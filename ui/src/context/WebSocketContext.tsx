import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
  useState,
} from "react";
import { SERVER_URL, WS_URL } from "../config/config";
import { Book, RestingOrder, Trade } from "../types/types";
import { SAMPLE_MS, useFeedStore } from "../stores/feedStore";

const SESSION_KEY = "obs_userId";
const MAX_TRADES = 200;

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

  // Seed the tape with recent prints so it isn't empty until the next trade.
  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER_URL}/trades?limit=${MAX_TRADES}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Trade[]>) : []))
      .then((seed) => {
        if (cancelled || !Array.isArray(seed)) return;
        setTrades((live) => {
          const seen = new Set(live.map((t) => `${t.trade_id}:${t.ts}`));
          const older = seed.filter((t) => !seen.has(`${t.trade_id}:${t.ts}`));
          return [...live, ...older].slice(0, MAX_TRADES);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let msgTotal = 0;
    let lastMsgAt: number | null = null;

    // Feed telemetry for the status bar: rate over the last second of samples.
    const samples: number[] = [];
    let sampledTotal = 0;
    const sampler = setInterval(() => {
      const delta = msgTotal - sampledTotal;
      sampledTotal = msgTotal;
      samples.push(delta);
      if (samples.length > 1000 / SAMPLE_MS) samples.shift();
      useFeedStore.setState({
        msgTotal,
        msgRate: samples.reduce((a, b) => a + b, 0),
        rx: delta > 0,
        lastMsgAt,
      });
    }, SAMPLE_MS);

    function connect() {
      // Append stored userId as query param so the server can reclaim the session.
      const stored = localStorage.getItem(SESSION_KEY);
      const url = stored ? `${WS_URL}?userId=${stored}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      useFeedStore.setState({ status: "connecting" });

      ws.onopen = () => {
        console.log("WebSocket connected");
        useFeedStore.setState({ status: "live", connectedAt: Date.now() });
      };

      ws.onmessage = (event) => {
        msgTotal++;
        lastMsgAt = Date.now();
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
          // The server sends trade fields at the top level, not under `payload`.
          const trade: Trade = msg.payload ?? msg;
          console.log("Received trade via WS", trade);
          setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
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
        useFeedStore.setState((s) => ({
          status: "down",
          connectedAt: null,
          reconnects: s.reconnects + 1,
        }));
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(sampler);
      if (wsRef.current) {
        // Detach so an intentional close doesn't schedule a reconnect.
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
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
