import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import OrderBookTable from "./components/OrderBookTable";
import DepthChart from "./components/DepthChart";
import TradeHistory from "./components/TradeHistory";
import OrderEntry from "./components/OrderEntry";
import RestingOrders from "./components/RestingOrders";
import Analytics from "./components/Analytics";
import Header from "./components/Header";
import TickerTape from "./components/TickerTape";
import QuoteStrip from "./components/QuoteStrip";
import StatusBar from "./components/StatusBar";
import AdminPage from "./pages/AdminPage";
import { WebSocketProvider } from "./context/WebSocketContext";
import ViewportGate from "./components/ViewportGate";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";

const GAP = 3;

// Shared terminal chrome: command bar, ticker tape, content, status bar.
function TerminalFrame() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "26px 20px 1fr 18px",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Header />
      <TickerTape />
      <main style={{ minHeight: 0, padding: GAP, boxSizing: "border-box" }}>
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}

function Dashboard() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 3fr 1fr",
        gridTemplateRows: "34px 1fr 1fr",
        height: "100%",
        gap: GAP,
      }}
    >
      {/* Security header */}
      <div style={{ gridColumn: "1 / 4", gridRow: "1", minWidth: 0 }}>
        <QuoteStrip />
      </div>

      {/* Left: Book Activity (full height) */}
      <div style={{ gridColumn: "1", gridRow: "2 / 4", minHeight: 0 }}>
        <TradeHistory />
      </div>

      {/* Center-top: Order Book */}
      <div style={{ gridColumn: "2", gridRow: "2", minHeight: 0 }}>
        <OrderBookTable />
      </div>

      {/* Center-bottom: Depth Chart */}
      <div style={{ gridColumn: "2", gridRow: "3", minHeight: 0 }}>
        <DepthChart />
      </div>

      {/* Right column: Resting Orders + Latency + Order Ticket */}
      <div
        style={{
          gridColumn: "3",
          gridRow: "2 / 4",
          display: "grid",
          gridTemplateRows: "2fr 1fr auto",
          gap: GAP,
          minHeight: 0,
        }}
      >
        <div style={{ minHeight: 0 }}>
          <RestingOrders />
        </div>
        <div style={{ minHeight: 0 }}>
          <Analytics />
        </div>
        <div>
          <OrderEntry />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <ViewportGate>
          <Routes>
            <Route element={<TerminalFrame />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/components" element={<AdminPage />} />
              <Route path="/performance" element={<PerformanceAnalytics />} />
            </Route>
          </Routes>
        </ViewportGate>
      </WebSocketProvider>
    </BrowserRouter>
  );
}
