import { useState, useEffect, useCallback } from "react";
import { SERVER_URL } from "../config/config";

export interface Position {
  cash: number;
  shares: number;
  netQty: number;
}

export function usePosition(userId: number | null): Position | null {
  const [position, setPosition] = useState<Position | null>(null);

  const poll = useCallback(async () => {
    if (userId == null) return;
    try {
      const res = await fetch(`${SERVER_URL}/user/position?user_id=${userId}`);
      const data = await res.json();
      setPosition({
        cash: data.cash ?? 1000,
        shares: data.shares ?? 10,
        netQty: data.netQty ?? 0,
      });
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  return position;
}
