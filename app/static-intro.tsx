"use client";

import { useEffect, useRef, useState } from "react";
import { Baloo_2 } from "next/font/google";

const baloo = Baloo_2({ subsets: ["latin"], weight: "800" });

const HOLD_MS = 2600; // how long the full static holds
const REVEAL_MS = 1800; // how long the fade-from-middle takes
const SCALE = 3; // noise chunkiness (bigger = chunkier pixels)

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
    let raf = 0;
    let stopped = false;
    const start = performance.now();

    const buildMask = () => {
      W = Math.ceil(window.innerWidth / SCALE);
      H = Math.ceil(window.innerHeight / SCALE);
      canvas.width = W;
      canvas.height = H;

      const m = document.createElement("canvas");
      m.width = W;
      m.height = H;
      const mctx = m.getContext("2d");
      if (!mctx) return;

      const fontSize = Math.min(W / 6.4, H / 3.2);
      mctx.font = `800 ${fontSize}px ${baloo.style.fontFamily}, "Arial Rounded MT Bold", sans-serif`;
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.lineJoin = "round";
      mctx.lineWidth = fontSize * 0.22; // fattens letters into bubbles
      mctx.strokeStyle = "#fff";
      mctx.fillStyle = "#fff";
      mctx.strokeText("Lonely Girl", W / 2, H / 2);
      mctx.fillText("Lonely Girl", W / 2, H / 2);
      mask = mctx.getImageData(0, 0, W, H).data;
    };

    buildMask();
    // Rebuild once the bubble font has actually loaded
    document.fonts?.ready.then(() => {
      if (!stopped) buildMask();
    });
    window.addEventListener("resize", buildMask);

    const draw = (now: number) => {
      if (stopped) return;
      const img = ctx.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        const inText = mask !== null && mask[o + 3] > 128;
        const v = Math.random();
        // Background: grey-ish static. Text: much blacker static.
        let r: number, g: number, b: number;
        if (inText) {
          r = g = b = 5 + v * 65;
        } else {
          r = g = b = 105 + v * 125;
        }
        // Occasional colour flecks mixed into the grey
        if (Math.random() < 0.07) {
          const c = Math.random();
          if (c < 0.34) r = Math.min(255, r + 90);
          else if (c < 0.67) g = Math.min(255, g + 75);
          else b = Math.min(255, b + 100);
        }
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);

      // Fade out from the middle after the hold
      const t = now - start;
      if (t > HOLD_MS) {
        const p = Math.min(1, (t - HOLD_MS) / REVEAL_MS);
        const ease = p * p * (3 - 2 * p);
        const maxR = Math.hypot(W / 2, H / 2) * 1.15;
        const rOut = ease * maxR;
        const grad = ctx.createRadialGradient(
          W / 2,
          H / 2,
          Math.max(0, rOut * 0.7),
          W / 2,
          H / 2,
          rOut
        );
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        if (p >= 1) {
          stopped = true;
          setGone(true);
          return;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", buildMask);
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
