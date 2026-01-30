export type Side = "bid" | "ask";

export type Level = {
  price: number;
  qty: number;
  orders?: number[];
};

export type Book = {
  bids: Level[];
  asks: Level[];
};

export interface Trade {
  seq: number;
  trade_id: number;
  price: number;
  qty: number;
  maker: number;
  taker: number;
  ts: number;
}
