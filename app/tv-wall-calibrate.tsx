"use client";

/*
 * Drag-to-position overlay for the TV screen quads. Dev tool only — mounted
 * by app/tv-wall.tsx when the page is opened with ?calibrate=1.
 *
 * Move a box to reposition a screen, drag a corner to resize it. The picture
 * follows live, so you're aiming at the real thing rather than numbers. When
 * it looks right, hit Copy and paste the quads into lib/tv-wall-config.mjs.
 *
 * Nothing here ships into a normal page load: without the query flag the
 * controller is never built and this component is never rendered.
 */

import { useCallback, useEffect, useState } from "react";

export type CalibratorTv = {
  name: string;
  /** Base quad in config space, [TL, TR, BR, BL], y measured from the top. */
  quad: number[][];
  radius: number;
  isVideo: boolean;
};

export type Calibrator = {
  layout: "wide" | "tall";
  tvs: CalibratorTv[];
  /** Config-space point -> viewport pixels. */
  toScreen: (x: number, y: number) => { x: number; y: number };
  /** Viewport pixels -> config-space point. */
  toConfig: (x: number, y: number) => { x: number; y: number };
  /** Push a new base quad into the live scene. */
  setQuad: (index: number, quad: number[][]) => void;
};

type Drag = {
  index: number;
  /** Which handle: the body moves the whole box, a corner resizes. */
  grip: "move" | "tl" | "tr" | "br" | "bl";
  startX: number;
  startY: number;
  origin: number[][];
};

const f4 = (n: number) => Number(n.toFixed(4));

/** Rebuild an axis-aligned quad from its two opposite corners. */
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export default function TvWallCalibrate({ calibrator }: { calibrator: Calibrator }) {
  const [quads, setQuads] = useState<number[][][]>(() => calibrator.tvs.map((t) => t.quad));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  /*
   * The panel starts folded and parked top-left over empty wall, and can be
   * dragged anywhere by its header — it has to be possible to reach every set
   * underneath it, and the sets move around as you calibrate.
   */
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 14, y: 14 });
  const [panelDrag, setPanelDrag] = useState<{ dx: number; dy: number } | null>(null);
  // Name tags overlap neighbouring sets on a dense wall, so they only show
  // for the box you're actually pointing at.
  const [hover, setHover] = useState<number | null>(null);

  // Handles are positioned in viewport pixels, so they have to be redrawn
  // whenever the wall re-fits.
  useEffect(() => {
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /*
   * Crossing the portrait/landscape breakpoint rebuilds the scene and hands
   * over a fresh controller with a different set of TVs (8 wide, 4 tall).
   * Without this the boxes keep the old layout's quads and collapse onto
   * nothing, so adopt whatever the new controller is describing.
   */
  useEffect(() => {
    setQuads(calibrator.tvs.map((t) => t.quad));
  }, [calibrator]);

  const apply = useCallback(
    (index: number, quad: number[][]) => {
      calibrator.setQuad(index, quad);
      setQuads((prev) => prev.map((q, i) => (i === index ? quad : q)));
    },
    [calibrator]
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const from = calibrator.toConfig(drag.startX, drag.startY);
      const to = calibrator.toConfig(e.clientX, e.clientY);
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const [tl, , br] = drag.origin;
      let [x0, y0] = tl;
      let [x1, y1] = br;

      if (drag.grip === "move") {
        x0 += dx;
        x1 += dx;
        y0 += dy;
        y1 += dy;
      } else {
        if (drag.grip === "tl" || drag.grip === "bl") x0 += dx;
        if (drag.grip === "tr" || drag.grip === "br") x1 += dx;
        if (drag.grip === "tl" || drag.grip === "tr") y0 += dy;
        if (drag.grip === "bl" || drag.grip === "br") y1 += dy;
        // Don't let a box be dragged inside-out.
        if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      }

      apply(drag.index, rect(x0, y0, x1, y1));
    };

    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, calibrator, apply]);

  useEffect(() => {
    if (!panelDrag) return;
    const onMove = (e: PointerEvent) =>
      setPanelPos({ x: e.clientX - panelDrag.dx, y: e.clientY - panelDrag.dy });
    const onUp = () => setPanelDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panelDrag]);

  const snippet = calibrator.tvs
    .map((tv, i) => {
      const [x0, y0] = quads[i][0];
      const [x1, y1] = quads[i][2];
      const q = `[[${f4(x0)}, ${f4(y0)}], [${f4(x1)}, ${f4(y0)}], [${f4(x1)}, ${f4(
        y1
      )}], [${f4(x0)}, ${f4(y1)}]]`;
      return `// ${tv.name}\nquad: ${q},`;
    })
    .join("\n");

  const grips: Drag["grip"][] = ["tl", "tr", "br", "bl"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} data-tick={tick}>
      {calibrator.tvs.map((tv, i) => {
        const [x0, y0] = quads[i][0];
        const [x1, y1] = quads[i][2];
        const a = calibrator.toScreen(x0, y0);
        const b = calibrator.toScreen(x1, y1);
        const left = Math.min(a.x, b.x);
        const top = Math.min(a.y, b.y);
        const width = Math.abs(b.x - a.x);
        const height = Math.abs(b.y - a.y);
        const round = tv.radius >= 0.5;

        return (
          <div
            key={tv.name}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            onPointerDown={(e) => {
              e.preventDefault();
              setDrag({
                index: i,
                grip: "move",
                startX: e.clientX,
                startY: e.clientY,
                origin: quads[i],
              });
            }}
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              boxSizing: "border-box",
              border: `2px solid ${tv.isVideo ? "#22d3ee" : "#f472b6"}`,
              borderRadius: round ? "50%" : 10,
              cursor: drag?.index === i && drag.grip === "move" ? "grabbing" : "grab",
              background: "rgba(34, 211, 238, 0.06)",
              touchAction: "none",
            }}
          >
            {(hover === i || drag?.index === i) && (
              <span
                style={{
                  position: "absolute",
                  top: -20,
                  left: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0b1020",
                  background: tv.isVideo ? "#22d3ee" : "#f472b6",
                  padding: "1px 6px",
                  borderRadius: 5,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {tv.name}
              </span>
            )}
            {grips.map((g) => (
              <span
                key={g}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDrag({
                    index: i,
                    grip: g,
                    startX: e.clientX,
                    startY: e.clientY,
                    origin: quads[i],
                  });
                }}
                style={{
                  position: "absolute",
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "#fff",
                  border: "2px solid #0b1020",
                  cursor: g === "tl" || g === "br" ? "nwse-resize" : "nesw-resize",
                  touchAction: "none",
                  left: g === "tl" || g === "bl" ? -7 : undefined,
                  right: g === "tr" || g === "br" ? -7 : undefined,
                  top: g === "tl" || g === "tr" ? -7 : undefined,
                  bottom: g === "bl" || g === "br" ? -7 : undefined,
                }}
              />
            ))}
          </div>
        );
      })}

      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: panelPos.x,
          top: panelPos.y,
          width: open ? 340 : "auto",
          maxHeight: "58vh",
          overflow: "auto",
          background: "#0b1020",
          color: "#e8ecff",
          borderRadius: 12,
          padding: open ? 14 : "8px 12px",
          fontSize: 11,
          fontFamily: "ui-monospace, Menlo, monospace",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong
            onPointerDown={(e) => {
              e.preventDefault();
              setPanelDrag({ dx: e.clientX - panelPos.x, dy: e.clientY - panelPos.y });
            }}
            title="Drag to move this panel"
            style={{ fontSize: 12, cursor: panelDrag ? "grabbing" : "grab", touchAction: "none" }}
          >
            ⠿ {calibrator.layout === "wide" ? "TVS" : "MOBILE_TVS"}
          </strong>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              marginLeft: "auto",
              width: "auto",
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 6,
              background: "transparent",
              color: "#e8ecff",
              border: "1px solid #33406b",
            }}
          >
            {open ? "Hide" : "Show"}
          </button>
          {open && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={{
                width: "auto",
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 6,
                background: "#22d3ee",
                color: "#0b1020",
                border: "none",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
        {open && (
          <>
            <p style={{ opacity: 0.7, margin: "8px 0", lineHeight: 1.4 }}>
              Drag a box to move it, a corner to resize. Hide this to reach the
              sets behind it, then paste these quads into lib/tv-wall-config.mjs.
            </p>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.45 }}>{snippet}</pre>
          </>
        )}
      </div>
    </div>
  );
}
