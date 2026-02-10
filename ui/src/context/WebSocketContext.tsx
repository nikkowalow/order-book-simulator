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

interface WebSocketContextValue {
  send: (message: object) => Promise<any>;
  userId: number | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

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
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Handle session assignment from server
        if (msg.type === "session" && msg.userId) {
          setUserId(msg.userId);
          console.log("Session assigned, userId:", msg.userId);
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

        // Unsolicited messages (book updates, trades, etc.) — ignored here
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        setUserId(null);
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
    <WebSocketContext.Provider value={{ send, userId }}>
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
