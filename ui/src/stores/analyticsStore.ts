import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AnalyticsState {
  latencies: number[];
  addLatency: (latency: number) => void;
  clear: () => void;
}

const MAX_POINTS = 300;

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      latencies: [],
      addLatency: (latency) =>
        set((state) => ({
          latencies: [...state.latencies.slice(-MAX_POINTS), latency],
        })),
      clear: () => set({ latencies: [] }),
    }),
    {
      name: "perf-store", // localStorage key
    },
  ),
);
