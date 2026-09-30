import { useEffect, useState } from "react";
import OrderBookTable from "./OrderBookTable";
import DepthChart from "./DepthChart";
import { T } from "../theme";

export default function ViewportGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isDesktop) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgba(0,0,0,0.45)",
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              margin: 16,
              background: "#000",
              border: `1px solid ${T.amber}`,
              color: T.amber,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            <div className="blink" style={{ color: T.down }}>
              ▲ DISPLAY TOO NARROW ▲
            </div>
            TERMINAL REQUIRES A DESKTOP OR LAPTOP
          </div>
        </div>
        <div style={{ flex: "0 0 60%" }}>
          <OrderBookTable />
        </div>
        <div style={{ flex: "0 0 40%" }}>
          <DepthChart />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
