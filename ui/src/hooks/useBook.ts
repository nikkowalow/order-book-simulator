import { useEffect, useState } from "react";
import { Book } from "../types/types";

export function useBook(intervalMs = 5) {
  const [book, setBook] = useState<Book | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBook = async () => {
      try {
        setErr(null);
        const res = await fetch("http://localhost:8080/book", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as Book;

        if (!cancelled) setBook(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to fetch /book");
      }
    };

    fetchBook();
    const id = setInterval(fetchBook, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { book, err };
}
