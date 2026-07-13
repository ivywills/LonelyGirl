"use client";

import { useEffect, useRef, useState } from "react";
import { Lobster } from "next/font/google";

const lobster = Lobster({ subsets: ["latin"], weight: "400" });

const HOLD_MS = 2600; // full static hold
const REVEAL_MS = 2000; // window over which chunks get released
const FALL_MS = 750; // how long a released chunk falls before it's gone
const SCALE = 3; // noise chunkiness (bigger = chunkier pixels)
const CELL = 2; // size of falling chunks, in low-res pixels

type Cell = { x: number; y: number; release: number };

export default function StaticIntro({
  children,
}: {
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let mask: Uint8ClampedArray | null = null;
    let cells: Cell[] = [];
    let raf = 0;
    let stopped = false;
    const start = performance.now();

    const noiseCanvas = document.createElement("canvas");
    const nctx = noiseCanvas.getContext("2d");

    const build = () => {
      W = Math.ceil(window.innerWidth / SCALE);
      H = Math.ceil(window.innerHeight / SCALE);
      canvas.width = W;
      canvas.height = H;
      noiseCanvas.width = W;
      noiseCanvas.height = H;

      // Text mask — cursive bubble script, thin plump stroke so the
      // counters (the holes in o, e, g...) stay open.
      const m = document.createElement("canvas");
      m.width = W;
      m.height = H;
      const mctx = m.getContext("2d");
      if (!mctx) return;
      const fontSize = Math.min(W / 7.5, H / 4.5);
      mctx.font = `400 ${fontSize}px ${lobster.style.fontFamily}, cursive`;
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.lineJoin = "round";
      mctx.lineWidth = fontSize * 0.04;
      mctx.strokeStyle = "#fff";
      mctx.fillStyle = "#fff";
      mctx.fillText("Lonely Girl", W / 2, H / 2);
      mctx.strokeText("Lonely Girl", W / 2, H / 2);
      mask = mctx.getImageData(0, 0, W, H).data;

      // Falling chunks: released from the centre outwards, with jitter.
      cells = [];
      const maxDist = Math.hypot(W / 2, H / 2);
      for (let cy = 0; cy < H; cy += CELL) {
        for (let cx = 0; cx < W; cx += CELL) {
          const d = Math.hypot(cx + CELL / 2 - W / 2, cy + CELL / 2 - H / 2);
          cells.push({
            x: cx,
            y: cy,
            release:
              HOLD_MS +
              (d / maxDist) * REVEAL_MS * 0.65 +
              Math.random() * REVEAL_MS * 0.35,
          });
        }
      }
    };

    build();
    document.fonts?.ready.then(() => {
      if (!stopped) build();
    });
    window.addEventListener("resize", build);

    const draw = (now: number) => {
      if (stopped || !nctx) return;
      const t = now - start;

      // Fresh static frame on the offscreen canvas
      const img = nctx.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        const inText = mask !== null && mask[o + 3] > 128;
        const v = Math.random();
        let r: number, g: number, b: number;
        if (inText) {
          r = g = b = 5 + v * 65;
        } else {
          r = g = b = 105 + v * 125;
        }
        if (Math.random() < 0.2) {
          const c = Math.random();
          const amt = inText ? 55 : 110;
          if (c < 0.2) r = Math.min(255, r + amt);
          else if (c < 0.4) g = Math.min(255, g + amt);
          else if (c < 0.6) b = Math.min(255, b + amt);
          else if (c < 0.75) {
            r = Math.min(255, r + amt);
            b = Math.min(255, b + amt);
          } else if (c < 0.9) {
            g = Math.min(255, g + amt);
            b = Math.min(255, b + amt);
          } else {
            r = Math.min(255, r + amt);
            g = Math.min(255, g + amt * 0.7);
          }
        }
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);

      // Composite: intact chunks in place, released chunks fall and fade
      ctx.clearRect(0, 0, W, H);
      let remaining = 0;
      for (const c of cells) {
        const dt = t - c.release;
        if (dt <= 0) {
          ctx.drawImage(noiseCanvas, c.x, c.y, CELL, CELL, c.x, c.y, CELL, CELL);
          remaining++;
        } else if (dt < FALL_MS) {
          const s = dt / 1000;
          const dy = 1600 * s * s + 60 * s; // gravity + a little initial push
          ctx.globalAlpha = 1 - dt / FALL_MS;
          ctx.drawImage(
            noiseCanvas,
            c.x,
            c.y,
            CELL,
            CELL,
            c.x,
            c.y + dy,
            CELL,
            CELL
          );
          ctx.globalAlpha = 1;
          remaining++;
        }
      }
      if (remaining === 0 && t > HOLD_MS) {
        stopped = true;
        setGone(true);
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", build);
    };
  }, []);

  return (
    <>
      {children}
      {!gone && (
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 50,
            imageRendering: "pixelated",
            background: "transparent",
          }}
        />
      )}
    </>
  );
}
