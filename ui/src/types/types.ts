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

export type OrderEventType = "NEW" | "FILL" | "PARTIAL_FILL" | "CANCELLED" | "REJECTED";

export interface OrderEvent {
  seq: number;
  batch_id: number;
  order_id: number;
  type: OrderEventType;
  price: number;
  qty: number;
  remaining_qty: number;
  ts: number;
}
