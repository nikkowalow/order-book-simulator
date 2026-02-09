export type Side = "bid" | "ask";

export enum OrderSide {
  Buy = "BUY",
  Sell = "SELL",
}

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

export type OrderEventType =
  | "NEW"
  | "FILL"
  | "PARTIAL_FILL"
  | "CANCELLED"
  | "REJECTED";

export interface OrderEvent {
  seq: number;
  batch_id: number;
  order_id: number;
  type: OrderEventType;
  side: OrderSide;
  price: number;
  qty: number;
  remaining_qty: number;
  ts: number;
}

export interface RestingOrder {
  id: number;
  user_id?: number;
  side: Side;
  price: number;
  qty: number;
}
