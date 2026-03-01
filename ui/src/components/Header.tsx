import { useLocation, Link } from "react-router-dom";
import logo from "../assets/osmium.png";
// import { useEffect, useState } from "react";
// import { SERVER_URL } from "../config/config";

// function ToggleSwitch({
//   checked,
//   onChange,
// }: {
//   checked: boolean;
//   onChange: () => void;
// }) {
//   return (
//     <button
//       onClick={onChange}
//       style={{
//         width: 40,
//         height: 22,
//         borderRadius: 11,
//         border: "none",
//         background: checked ? "rgb(34, 197, 94)" : "rgba(255,255,255,0.2)",
//         position: "relative",
//         cursor: "pointer",
//         transition: "background 0.2s",
//       }}
//     >
//       <div
//         style={{
//           width: 16,
//           height: 16,
//           borderRadius: 8,
//           background: "white",
//           position: "absolute",
//           top: 3,
//           left: checked ? 21 : 3,
//           transition: "left 0.2s",
//         }}
//       />
//     </button>
//   );
// }

const TABS = [
  { label: "Simulator", path: "/" },
  { label: "Performance", path: "/performance" },
];

export default function Header() {
  const { pathname } = useLocation();
  //     const [mmRunning, setMmRunning] = useState<boolean>(true);

  //   useEffect(() => {
  //     fetch(`${SERVER_URL}/market_maker/status`)
  //       .then((res) => res.json())
  //       .then((data) => setMmRunning(data.running))
  //       .catch(() => setMmRunning(false));
  //   }, []);

  //   const toggleMarketMaker = async () => {
  //     try {
  //       const res = await fetch(`${SERVER_URL}/market_maker/toggle`, {
  //         method: "POST",
  //       });
  //       const data = await res.json();
  //       setMmRunning(data.running);
  //     } catch {
  //       // ignore
  //     }
  //   };

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={logo} alt="Logo" style={{ height: 28, width: 28 }} />
        {/* <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
          Order Book Simulator
        </span> */}
      </div>

      {/* Center tabs */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {TABS.map(({ label, path }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                letterSpacing: "0.02em",
                textDecoration: "none",
                color: active
                  ? "rgba(255,255,255,0.9)"
                  : "rgba(255,255,255,0.4)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                border: `1px solid ${active ? "rgba(255,255,255,0.15)" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {/* Market Maker Toggle */}
        {/* <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            Market Maker
          </span>
          <ToggleSwitch checked={mmRunning} onChange={toggleMarketMaker} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: mmRunning ? "rgb(34, 197, 94)" : "rgba(255,255,255,0.4)",
            }}
          >
            {mmRunning ? "ON" : "OFF"}
          </span>
        </div>

        <div
          style={{
            width: 1,
            height: 20,
            background: "rgba(255,255,255,0.1)",
          }}
        /> */}

        <a
          href="https://github.com/nikkowalow/order-book-simulator"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(255,255,255,0.7)", display: "flex" }}
        >
          <svg height="24" width="24" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
