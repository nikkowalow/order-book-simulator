import { useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import logo from "../assets/osmium.png";
import { useNow } from "../hooks/useNow";
import { useFeedStore } from "../stores/feedStore";
import { T } from "../theme";

const GITHUB_URL = "https://github.com/nikkowalow/order-book-simulator";

const TABS = [
  { key: "1", mnemonic: "BOOK", path: "/" },
  { key: "2", mnemonic: "PERF", path: "/performance" },
];

// Command-line mnemonics → routes. Menu numbers work too, Bloomberg style.
const COMMANDS: Record<string, string> = {
  "1": "/",
  BOOK: "/",
  OB: "/",
  "2": "/performance",
  PERF: "/performance",
  BENCH: "/performance",
};

const ZONES = [
  ["NY", "America/New_York"],
  ["LDN", "Europe/London"],
  ["TYO", "Asia/Tokyo"],
].map(([label, timeZone]) => ({
  label,
  fmt: new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }),
}));

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

type Reply = { text: string; ok: boolean; n: number } | null;

function CommandLine() {
  const navigate = useNavigate();
  const [cmd, setCmd] = useState("");
  const [reply, setReply] = useState<Reply>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (text: string, ok: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setReply((r) => ({ text, ok, n: (r?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setReply(null), 4000);
  };

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const c = cmd.trim().toUpperCase().replace(/\s*<?GO>?$/, "");
    setCmd("");
    if (!c) return;

    if (COMMANDS[c]) {
      navigate(COMMANDS[c]);
      say(`${c} <GO>`, true);
    } else if (c === "GH" || c === "SRC") {
      window.open(GITHUB_URL, "_blank", "noopener,noreferrer");
      say("OPENING SOURCE", true);
    } else if (c === "HELP" || c === "?") {
      say("1 BOOK · 2 PERF · GH SOURCE", true);
    } else {
      say(`UNKNOWN FUNCTION '${c}'`, false);
    }
  };

  return (
    <form
      onSubmit={run}
      style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
    >
      <span style={{ color: T.amber, fontWeight: 700 }}>&gt;</span>
      <input
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        placeholder="TYPE FUNCTION · HELP <GO>"
        spellCheck={false}
        aria-label="Command line"
        className="t-input"
        style={{
          width: 210,
          height: 18,
          fontSize: 11,
          textTransform: "uppercase",
          background: "#0b0b0b",
        }}
      />
      <button type="submit" className="t-btn on" style={{ padding: "0 6px" }}>
        &lt;GO&gt;
      </button>
      {reply && (
        <span
          key={reply.n}
          className="fx flash-hot"
          style={{
            color: reply.ok ? T.yellow : T.down,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {reply.text}
        </span>
      )}
    </form>
  );
}

function FeedLed() {
  const status = useFeedStore((s) => s.status);
  const color =
    status === "live" ? T.up : status === "connecting" ? T.yellow : T.down;
  const label =
    status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING" : "NO FEED";

  return (
    <span
      style={{ display: "flex", alignItems: "center", gap: 5, color, fontWeight: 700 }}
      title="WebSocket feed"
    >
      <span className={status === "live" ? "led" : "led blink-fast"} />
      <span className={status === "live" ? undefined : "blink"}>{label}</span>
    </span>
  );
}

function Clocks() {
  const now = useNow(1000);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {ZONES.map(({ label, fmt }) => (
        <span key={label} style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: T.amber }}>{label}</span>{" "}
          <span style={{ color: T.text }}>{fmt.format(now)}</span>
        </span>
      ))}
      <span style={{ color: T.dim, whiteSpace: "nowrap" }}>
        {DATE_FMT.format(now).toUpperCase()}
      </span>
    </div>
  );
}

export default function Header() {
  const { pathname } = useLocation();

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 8px",
        background: "#0a0a0a",
        borderBottom: `1px solid ${T.amber}`,
        fontSize: 11,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <img src={logo} alt="Logo" style={{ height: 18, width: 18 }} />
        <span
          className="glow"
          style={{ color: T.amber, fontWeight: 700, letterSpacing: "0.12em" }}
        >
          OSMIUM
        </span>
      </div>

      <CommandLine />

      <nav style={{ display: "flex", gap: 4 }}>
        {TABS.map(({ key, mnemonic, path }) => (
          <Link
            key={path}
            to={path}
            className={pathname === path ? "t-btn on" : "t-btn"}
            style={{ textDecoration: "none" }}
          >
            {key}) {mnemonic}
          </Link>
        ))}
      </nav>

      <div
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}
      >
        <FeedLed />
        <Clocks />
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Source on GitHub"
          style={{ color: T.dim, display: "flex" }}
        >
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
