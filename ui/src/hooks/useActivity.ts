import { useEffect, useState } from "react";
import { OrderEvent } from "../types/types";

export function useActivity(limit = 100) {
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchActivity = async () => {
      try {
        const res = await fetch(`http://localhost:8080/activity?limit=${limit}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as OrderEvent[];
        if (!cancelled) {
          setEvents(data);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e.message ?? "Failed to fetch activity");
        }
      }
    };

    fetchActivity();

    const id = setInterval(fetchActivity, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [limit]);

  return { events, err };
}
