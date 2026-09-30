import { ReactNode } from "react";
import { T } from "../theme";

// Terminal window: amber function-code tag, title, right-aligned status meta.
export default function Panel({
  code,
  title,
  meta,
  children,
  bodyStyle,
}: {
  code: string;
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <section className="panel">
      <header className="panel-hdr">
        <span className="panel-code">{code}</span>
        <span className="panel-title">{title}</span>
        {meta && <span className="panel-meta">{meta}</span>}
      </header>
      <div className="panel-body" style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}

// Blinking "LIVE"-style indicator for panel headers.
export function LiveTag({
  label = "LIVE",
  color = T.up,
  blink = true,
}: {
  label?: string;
  color?: string;
  blink?: boolean;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, color }}>
      <span className={blink ? "led blink" : "led"} />
      {label}
    </span>
  );
}
