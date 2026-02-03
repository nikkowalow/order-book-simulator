import { useEffect, useState } from "react";
import { Trade } from "../types/types";
import { SERVER_URL } from "../config/config";

export function useTrades(limit = 100) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTrades = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/trades?limit=${limit}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as Trade[];
        if (!cancelled) {
          setTrades(data);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message ?? "Failed to fetch trades");
        }
      }
    };

    fetchTrades();

    const id = setInterval(fetchTrades, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [limit]);

  return { trades, err };
}
