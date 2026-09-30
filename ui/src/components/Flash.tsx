import { ReactNode } from "react";
import { useFlash } from "../hooks/useFlash";

// Renders `children` (or `value`) and flashes it green/red/amber when `value` changes.
export default function Flash({
  value,
  children,
  style,
}: {
  value: unknown;
  children?: ReactNode;
  style?: React.CSSProperties;
}) {
  const flash = useFlash(value);

  return (
    <span
      key={flash?.n ?? 0}
      className={flash ? `fx flash-${flash.dir}` : "fx"}
      style={style}
    >
      {children ?? String(value ?? "—")}
    </span>
  );
}
