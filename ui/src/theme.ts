// Terminal palette for inline styles, canvas and SVG.
// Keep in sync with the CSS variables in index.css.
export const T = {
  bg: "#000000",
  panel: "#060606",
  panelHdr: "#121212",
  line: "#262626",
  lineSoft: "#151515",

  amber: "#ff9e1b",
  amberDim: "#8a5410",
  yellow: "#ffd23f",
  text: "#e6e6e6",
  dim: "#8c8c8c",
  mute: "#4d4d4d",

  up: "#20e050",
  upBg: "rgba(32,224,80,0.16)",
  down: "#ff3d3d",
  downBg: "rgba(255,61,61,0.16)",

  cyan: "#38d6ff",
  magenta: "#ff5cf0",
  navy: "#0e1f47",
  navyText: "#c9d6ff",

  font: "'IBM Plex Mono', Menlo, Consolas, monospace",
};

export function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
