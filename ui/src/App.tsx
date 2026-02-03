import OrderBookTable from "./components/OrderBookTable";
import DepthChart from "./components/DepthChart";
import TradeHistory from "./components/TradeHistory";
import OrderEntry from "./components/OrderEntry";
import RestingOrders from "./components/RestingOrders";
import Header from "./components/Header";

export default function App() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 3fr 1fr",
        gridTemplateRows: "48px 1fr 1fr",
        height: "100vh",
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ gridColumn: "1 / 4", gridRow: "1" }}>
        <Header />
      </div>

      {/* Left: Trade History (full height) */}
      <div style={{ gridColumn: "1", gridRow: "2 / 4", overflow: "auto" }}>
        <TradeHistory />
      </div>

      {/* Center-top: Order Book Table */}
      <div style={{ gridColumn: "2", gridRow: "2", overflow: "auto" }}>
        <OrderBookTable />
      </div>

      {/* Center-bottom: Depth Chart */}
      <div style={{ gridColumn: "2", gridRow: "3", overflow: "auto" }}>
        <DepthChart />
      </div>

      {/* Right column: Resting Orders + Order Entry */}
      <div
        style={{
          gridColumn: "3",
          gridRow: "2 / 4",
          display: "grid",
          gridTemplateRows: "4fr 1fr",
          gap: 8,
          overflow: "hidden",
        }}
      >
        <div style={{ overflow: "auto" }}>
          <RestingOrders />
        </div>

        <div style={{ overflow: "auto" }}>
          <OrderEntry />
        </div>
      </div>
    </div>
  );
}
