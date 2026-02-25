import { useState, useEffect, useCallback } from "react";
import { SERVER_URL } from "../config/config";

export interface Position {
  balance: number;
  reservedBalance: number;
  shares: number;
  reservedShares: number;
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
        balance: data.balance ?? 1000,
        reservedBalance: data.reservedBalance ?? 0,
        shares: data.shares ?? 10,
        reservedShares: data.reservedShares ?? 0,
        netQty: data.netQty ?? 0,
      });
    } catch {}
  }, [userId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  return position;
}
