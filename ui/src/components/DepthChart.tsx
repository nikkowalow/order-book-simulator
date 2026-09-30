import { useMemo, useRef, useEffect, useState } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import Panel from "./Panel";
import { T, fmt } from "../theme";

type Point = { price: number; cumQty: number };

const FONT = `13px ${T.font}`;

export default function DepthChart() {
  const { book } = useWebSocket();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    if (boxRef.current) obs.observe(boxRef.current);
    return () => obs.disconnect();
  }, []);

  const cumulative = useMemo(() => {
    if (!book) return null;

    // Bids: descending price, cumulative qty
    const bidPoints: Point[] = [];
    let cum = 0;
    for (const lvl of book.bids) {
      cum += lvl.qty;
      bidPoints.push({ price: lvl.price, cumQty: cum });
    }

    // Asks: ascending price, cumulative qty
    const askPoints: Point[] = [];
    cum = 0;
    for (const lvl of book.asks) {
      cum += lvl.qty;
      askPoints.push({ price: lvl.price, cumQty: cum });
    }

    return { bidPoints, askPoints };
  }, [book]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cumulative || size.w === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = { top: 12, right: 14, bottom: 24, left: 58 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const { bidPoints, askPoints } = cumulative;
    if (bidPoints.length === 0 && askPoints.length === 0) return;

    // Price range
    const allPrices = [
      ...bidPoints.map((p) => p.price),
      ...askPoints.map((p) => p.price),
    ];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    // Qty range
    const maxQty = Math.max(
      bidPoints.length ? bidPoints[bidPoints.length - 1].cumQty : 0,
      askPoints.length ? askPoints[askPoints.length - 1].cumQty : 0,
    );
    const qtyRange = maxQty || 1;

    const toX = (price: number) =>
      pad.left + ((price - minPrice) / priceRange) * plotW;
    const toY = (qty: number) => pad.top + plotH - (qty / qtyRange) * plotH;

    // Dotted grid
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(pad.top + (plotH / 4) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = Math.round(pad.left + (plotW / 5) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Step curve: horizontal to next price, then vertical to its cumQty.
    const drawSide = (points: Point[], stroke: string, fill: string) => {
      if (points.length === 0) return;
      const trace = () => {
        ctx.lineTo(toX(points[0].price), toY(points[0].cumQty));
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(toX(points[i].price), toY(points[i - 1].cumQty));
          ctx.lineTo(toX(points[i].price), toY(points[i].cumQty));
        }
      };

      ctx.beginPath();
      ctx.moveTo(toX(points[0].price), toY(0));
      trace();
      ctx.lineTo(toX(points[points.length - 1].price), toY(0));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(points[0].price), toY(points[0].cumQty));
      trace();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    drawSide(bidPoints, T.up, T.upBg);
    drawSide(askPoints, T.down, T.downBg);

    // Axis labels
    ctx.font = FONT;
    ctx.fillStyle = T.dim;
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange / 5) * i;
      ctx.fillText(price.toFixed(0), toX(price), h - 7);
    }
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const qty = (qtyRange / 4) * (4 - i);
      ctx.fillText(qty.toFixed(0), pad.left - 6, pad.top + (plotH / 4) * i + 4);
    }

    // Tag drawn in a filled box, clamped inside the plot.
    const tag = (text: string, x: number, y: number, bg: string) => {
      const tw = ctx.measureText(text).width + 8;
      const bx = Math.min(Math.max(x - tw / 2, pad.left), w - pad.right - tw);
      ctx.fillStyle = bg;
      ctx.fillRect(bx, y, tw, 17);
      ctx.fillStyle = "#000";
      ctx.textAlign = "left";
      ctx.fillText(text, bx + 4, y + 13);
    };

    // Mid marker
    if (bidPoints.length && askPoints.length) {
      const mid = (bidPoints[0].price + askPoints[0].price) / 2;
      const x = Math.round(toX(mid)) + 0.5;
      ctx.strokeStyle = T.amber;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      tag(`MID ${mid.toFixed(2)}`, x, pad.top, T.amber);
    }

    // Crosshair readout
    if (hoverX != null && hoverX >= pad.left && hoverX <= w - pad.right) {
      const price = minPrice + ((hoverX - pad.left) / plotW) * priceRange;
      const bestBid = bidPoints[0]?.price ?? -Infinity;
      const bestAsk = askPoints[0]?.price ?? Infinity;
      let qty: number | null = null;
      if (price <= bestBid) {
        qty = bidPoints.filter((p) => p.price >= price).pop()?.cumQty ?? null;
      } else if (price >= bestAsk) {
        qty = askPoints.filter((p) => p.price <= price).pop()?.cumQty ?? null;
      }

      ctx.strokeStyle = T.text;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, pad.top);
      ctx.lineTo(hoverX + 0.5, pad.top + plotH);
      if (qty != null) {
        ctx.moveTo(pad.left, Math.round(toY(qty)) + 0.5);
        ctx.lineTo(w - pad.right, Math.round(toY(qty)) + 0.5);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      tag(price.toFixed(1), hoverX, pad.top + plotH + 1, T.text);
      if (qty != null) {
        tag(`CUM ${fmt(qty)}`, hoverX, toY(qty) - 19, price <= bestBid ? T.up : T.down);
      }
    }
  }, [cumulative, size, hoverX]);

  return (
    <Panel
      code="DP"
      title="Market Depth · Cumulative"
      meta={
        <>
          <span style={{ color: T.up }}>■ BID</span>
          <span style={{ color: T.down }}>■ ASK</span>
          <span style={{ color: T.amber }}>┆ MID</span>
        </>
      }
      bodyStyle={{ overflow: "hidden", padding: 6 }}
    >
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!book && (
          <div className="blink" style={{ color: T.amber }}>
            LOADING DEPTH…
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseMove={(e) =>
            setHoverX(e.clientX - e.currentTarget.getBoundingClientRect().left)
          }
          onMouseLeave={() => setHoverX(null)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "crosshair",
          }}
        />
      </div>
    </Panel>
  );
}
