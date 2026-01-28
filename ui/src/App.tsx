import React from "react";
import OrderBookTable from "./components/OrderBookTable";
import OrderEntry from "./components/OrderEntry";
import DepthChart from "./components/DepthChart";
import TradeHistory from "./components/TradeHistory";

export default function App() {
  return (
    <>
      <OrderEntry />
      <OrderBookTable />
      <DepthChart />
      <TradeHistory />
    </>
  );
}
