export type Side = "bid" | "ask";

export type Level = {
  price: number;
  qty: number;
};

export type Book = {
  bids: Level[];
  asks: Level[];
};
