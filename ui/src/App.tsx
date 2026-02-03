import OrderBookTable from "./components/OrderBookTable";
import DepthChart from "./components/DepthChart";
import TradeHistory from "./components/TradeHistory";
import OrderEntry from "./components/OrderEntry";
import RestingOrders from "./components/RestingOrders";

export default function App() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 3fr 1fr",
        gridTemplateRows: "1fr 1fr",
        height: "100vh",
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {/* Left: Analytics (full height) */}

      <div style={{ gridColumn: "1", gridRow: "1 / 3", overflow: "auto" }}>
        <TradeHistory />
      </div>
      {/* Center-top: Order Book Table */}
      <div style={{ gridColumn: "2", gridRow: "1", overflow: "auto" }}>
        <OrderBookTable />
      </div>

      {/* Center-bottom: Depth Chart */}
      <div style={{ gridColumn: "2", gridRow: "2", overflow: "auto" }}>
        <DepthChart />
      </div>

      {/* Right column: 4/5 TradeHistory, 1/5 OrderEntry */}
      <div
        style={{
          gridColumn: "3",
          gridRow: "1 / 3",
          display: "grid",
          gridTemplateRows: "4fr 1fr",
          gap: 8,
          overflow: "hidden",
        }}
      >
        <div style={{ gridColumn: "1", gridRow: "1 / 3", overflow: "auto" }}>
          <RestingOrders />
        </div>

        <div style={{ overflow: "auto" }}>
          <OrderEntry />
        </div>
      </div>
    </div>
  );
}
