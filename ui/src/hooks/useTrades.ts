import { useEffect, useState } from "react";
import { Trade } from "../types/types";

export function useTrades(limit = 100) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch(`http://localhost:8080/trades?limit=${limit}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as Trade[];
        setTrades(data);
        setErr(null);
      } catch (e: any) {
        setErr(e.message ?? "Failed to fetch trades");
        setTrades(null);
      }
    };

    fetchTrades();
  }, [limit]);

  return { trades, err };
}
