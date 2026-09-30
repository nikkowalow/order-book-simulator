import { useEffect, useRef, useState } from "react";

export type FlashDir = "up" | "down" | "hot";

// Emits a new flash each time `value` changes. Numbers flash up/down by
// direction; any other change flashes "hot". `n` changes on every flash so
// callers can key an element on it to restart the CSS animation.
export function useFlash(value: unknown) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ dir: FlashDir; n: number } | null>(
    null,
  );

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === value || before == null || value == null) return;

    const dir: FlashDir =
      typeof value === "number" && typeof before === "number"
        ? value > before
          ? "up"
          : "down"
        : "hot";
    setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
  }, [value]);

  return flash;
}
