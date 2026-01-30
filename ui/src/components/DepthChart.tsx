import { useMemo, useRef, useEffect } from "react";
import { useBook } from "../hooks/useBook";

export default function DepthChart() {
  const { book, err } = useBook();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cumulative = useMemo(() => {
    if (!book) return null;

    // Bids: descending price, cumulative qty
    const bidPoints: { price: number; cumQty: number }[] = [];
    let cum = 0;
    for (const lvl of book.bids) {
      cum += lvl.qty;
      bidPoints.push({ price: lvl.price, cumQty: cum });
    }

    // Asks: ascending price, cumulative qty
    const askPoints: { price: number; cumQty: number }[] = [];
    cum = 0;
    for (const lvl of book.asks) {
      cum += lvl.qty;
      askPoints.push({ price: lvl.price, cumQty: cum });
    }

    return { bidPoints, askPoints };
  }, [book]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cumulative) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
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

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Draw bid area (step/staircase: horizontal then vertical)
    if (bidPoints.length > 0) {
      // Fill
      ctx.beginPath();
      ctx.moveTo(toX(bidPoints[0].price), toY(0));
      ctx.lineTo(toX(bidPoints[0].price), toY(bidPoints[0].cumQty));
      for (let i = 1; i < bidPoints.length; i++) {
        // Horizontal to next price at current cumQty
        ctx.lineTo(toX(bidPoints[i].price), toY(bidPoints[i - 1].cumQty));
        // Vertical step up to new cumQty
        ctx.lineTo(toX(bidPoints[i].price), toY(bidPoints[i].cumQty));
      }
      ctx.lineTo(toX(bidPoints[bidPoints.length - 1].price), toY(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(34,197,94,0.15)";
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(toX(bidPoints[0].price), toY(bidPoints[0].cumQty));
      for (let i = 1; i < bidPoints.length; i++) {
        ctx.lineTo(toX(bidPoints[i].price), toY(bidPoints[i - 1].cumQty));
        ctx.lineTo(toX(bidPoints[i].price), toY(bidPoints[i].cumQty));
      }
      ctx.strokeStyle = "rgb(22,163,74)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw ask area (step/staircase: horizontal then vertical)
    if (askPoints.length > 0) {
      // Fill
      ctx.beginPath();
      ctx.moveTo(toX(askPoints[0].price), toY(0));
      ctx.lineTo(toX(askPoints[0].price), toY(askPoints[0].cumQty));
      for (let i = 1; i < askPoints.length; i++) {
        ctx.lineTo(toX(askPoints[i].price), toY(askPoints[i - 1].cumQty));
        ctx.lineTo(toX(askPoints[i].price), toY(askPoints[i].cumQty));
      }
      ctx.lineTo(toX(askPoints[askPoints.length - 1].price), toY(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(239,68,68,0.15)";
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(toX(askPoints[0].price), toY(askPoints[0].cumQty));
      for (let i = 1; i < askPoints.length; i++) {
        ctx.lineTo(toX(askPoints[i].price), toY(askPoints[i - 1].cumQty));
        ctx.lineTo(toX(askPoints[i].price), toY(askPoints[i].cumQty));
      }
      ctx.strokeStyle = "rgb(220,38,38)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Axes labels
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Price labels along bottom
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRange / priceSteps) * i;
      ctx.fillText(price.toFixed(0), toX(price), h - 8);
    }

    // Qty labels along left
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const qty = (qtyRange / 4) * (4 - i);
      const y = pad.top + (plotH / 4) * i;
      ctx.fillText(qty.toFixed(0), pad.left - 8, y + 4);
    }
  }, [cumulative]);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "16px auto", color: "crimson" }}>
        Depth chart error: {err}
      </div>
    );
  }

  if (!book) {
    return <div style={{ maxWidth: 900, margin: "16px auto" }}>Loading...</div>;
  }

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 16px 8px 16px",
          fontWeight: 700,
          letterSpacing: 0.3,
          flexShrink: 0,
        }}
      >
        Depth
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "0 16px 16px 16px",
          boxSizing: "border-box",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
