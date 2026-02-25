import { useEffect, useState } from "react";
import OrderBookTable from "./OrderBookTable";
import DepthChart from "./DepthChart";

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
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgba(0,0,0,0.2)",
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.9)",
              fontFamily: "monospace",
              fontSize: 18,
              letterSpacing: 2,
              textTransform: "uppercase",
              textAlign: "center",
              margin: 0,
            }}
          >
            Please view on a desktop or laptop
          </p>
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
