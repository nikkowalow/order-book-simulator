import React from "react";
import OrderBookTable from "./components/OrderBookTable";
import OrderEntry from "./components/OrderEntry";
import DepthChart from "./components/DepthChart";

export default function App() {
  return (
    <>
      <OrderEntry />
      <OrderBookTable />
      <DepthChart />
    </>
  );
}
