import { create } from "zustand";

export type FeedStatus = "connecting" | "live" | "down";

// Written by WebSocketProvider; sampled at SAMPLE_MS so subscribers
// re-render a few times a second rather than on every message.
interface FeedState {
  status: FeedStatus;
  reconnects: number;
  connectedAt: number | null;
  msgTotal: number;
  msgRate: number; // messages/sec over the last second
  rx: boolean; // traffic seen during the last sample window
  lastMsgAt: number | null;
}

export const SAMPLE_MS = 250;

export const useFeedStore = create<FeedState>()(() => ({
  status: "connecting",
  reconnects: 0,
  connectedAt: null,
  msgTotal: 0,
  msgRate: 0,
  rx: false,
  lastMsgAt: null,
}));
