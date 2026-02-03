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

export default function Header() {
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
      <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
        Order Book Simulator
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

        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          Guest
        </span>
        <button
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.8)",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Log In
        </button>
      </div>
    </div>
  );
}
