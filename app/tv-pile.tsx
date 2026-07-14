"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STAGE_W = 680;
const STAGE_H = 640;
const DX = 11;
const DY = 8;
const NOISE_SCALE = 3;

type TvDef = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  body: string;
  panel: string;
  bezel: string;
  acc1: string;
  acc2: string;
  type: "console" | "panel" | "plain" | "portable" | "antenna";
  controls: "dials" | "sliders" | "buttons" | "toggles";
  screen: "rect" | "round";
  shape?: "egg" | "arch";
  wood?: boolean;
  floor?: boolean;
  /** future: route this TV navigates to once real pages exist */
  href?: string;
};

const TVS: TvDef[] = [
  { id: "b", x: 10, y: 468, w: 172, h: 132, body: "#79aad4", panel: "#6795bd", bezel: "#16222e", acc1: "#ffe08a", acc2: "#eaf3fb", type: "panel", controls: "sliders", screen: "rect", floor: true },
  { id: "f", x: 36, y: 387, w: 108, h: 84, body: "#7a4b6e", panel: "#cfc4b4", bezel: "#20121c", acc1: "#e8955c", acc2: "#7a4b6e", type: "portable", controls: "dials", screen: "rect" },
  { id: "a", x: 190, y: 426, w: 200, h: 152, body: "#7a5e42", panel: "#664d38", bezel: "#1c140d", acc1: "#d8b36a", acc2: "#b9a5f7", type: "console", wood: true, controls: "dials", screen: "rect", floor: true },
  { id: "c", x: 211, y: 311, w: 164, h: 118, body: "#8a6a49", panel: "#76573b", bezel: "#1d1410", acc1: "#ef99c2", acc2: "#8fb1ff", type: "plain", controls: "sliders", screen: "rect", wood: true },
  { id: "e", x: 226, y: 208, w: 140, h: 106, body: "#5c5480", panel: "#4f476c", bezel: "#191426", acc1: "#b9a5f7", acc2: "#ef99c2", type: "antenna", controls: "dials", screen: "rect", shape: "arch" },
  { id: "g", x: 396, y: 488, w: 148, h: 112, body: "#7fb2d9", panel: "#6b9dc4", bezel: "#14222e", acc1: "#7de3d0", acc2: "#e0c56a", type: "plain", controls: "toggles", screen: "round", floor: true },
  { id: "h", x: 418, y: 415, w: 100, h: 76, body: "#a98ce8", panel: "#9678d4", bezel: "#241a38", acc1: "#c77dff", acc2: "#f0e6ff", type: "plain", controls: "toggles", screen: "rect" },
  { id: "d", x: 560, y: 510, w: 116, h: 90, body: "#4d608c", panel: "#415178", bezel: "#141c2e", acc1: "#8fb1ff", acc2: "#e0c56a", type: "plain", controls: "buttons", screen: "rect", floor: true },
];

function sh(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function Dial({ size, color, angle }: { size: number; color: string; angle: number }) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        margin: "5px auto 0",
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #2b2638, #15121b 72%)",
        border: "1.5px solid rgba(255,255,255,0.28)",
        boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.6), inset 0 2px 2px rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 2,
          width: 2,
          height: "36%",
          background: color,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "bottom",
        }}
      />
      {[0, 90, 180, 270].map((r) => (
        <div
          key={r}
          style={{
            position: "absolute",
            left: "50%",
            top: -4,
            width: 1.5,
            height: 3,
            background: "rgba(255,255,255,0.4)",
            transformOrigin: `50% ${size / 2 + 4}px`,
            transform: `translateX(-50%) rotate(${r}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function Controls({ t }: { t: TvDef }) {
  const kd = Math.max(12, Math.round(t.w * 0.075));
  if (t.controls === "dials")
    return (
      <>
        <Dial size={kd} color={t.acc1} angle={28} />
        <Dial size={Math.round(kd * 0.7)} color={t.acc2} angle={-40} />
      </>
    );
  if (t.controls === "sliders")
    return (
      <div style={{ display: "flex", gap: 9, justifyContent: "center", marginTop: 8, height: "44%" }}>
        {[
          [t.acc1, "26%"],
          [t.acc2, "58%"],
        ].map(([col, top], i) => (
          <div
            key={i}
            style={{
              position: "relative",
              width: 5,
              height: "100%",
              background: "#15121b",
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top,
                transform: "translateX(-50%)",
                width: 13,
                height: 7,
                borderRadius: 2,
                background: col,
                border: "1px solid rgba(0,0,0,0.6)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            />
          </div>
        ))}
      </div>
    );
  if (t.controls === "buttons")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3, margin: "7px 14% 0" }}>
        {[t.acc1, t.acc2, t.acc1, "#d8b36a"].map((c, i) => (
          <div
            key={i}
            style={{
              height: 8,
              borderRadius: 2,
              background: sh(t.body, i === 1 ? 1.5 : 1.25),
              border: "1px solid rgba(0,0,0,0.55)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              borderLeft: `3px solid ${c}`,
            }}
          />
        ))}
      </div>
    );
  return (
    <>
      <Dial size={Math.max(12, Math.round(t.w * 0.11))} color={t.acc1} angle={28} />
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 7 }}>
        {[
          [t.acc1, -22],
          [t.acc2, 20],
        ].map(([col, rot], i) => (
          <div
            key={i}
            style={{
              position: "relative",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#15121b",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: "45%",
                width: 2.5,
                height: 10,
                borderRadius: 2,
                background: "#9a93a8",
                borderTop: `3px solid ${col}`,
                transform: `translateX(-50%) rotate(${rot}deg)`,
                transformOrigin: "bottom",
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function Tv({
  t,
  pos,
  floor,
  onClick,
  canvasRef,
}: {
  t: TvDef;
  pos: { x: number; y: number; rot?: number; legs?: boolean };
  floor: boolean;
  onClick: () => void;
  canvasRef: (el: HTMLCanvasElement | null) => void;
}) {
  const pad = Math.round(t.h * 0.085);
  const scrW = Math.round(t.w * 0.62);
  const scrH = t.h - pad * 2;
  const inset = Math.max(4, Math.round(t.h * 0.05));
  const round = t.screen === "round";
  const egg = t.shape === "egg";
  const arch = t.shape === "arch";
  const eggSize = Math.round(Math.min(t.w, t.h) * 0.8);
  const dsz = Math.min(scrW, scrH) + 8;
  const roundScreen = egg ? eggSize - 14 : Math.min(scrW, scrH) - 4;
  const cvSize = round
    ? { w: roundScreen, h: roundScreen }
    : { w: scrW - 2 * inset, h: scrH - 2 * inset };
  const cx = pad + scrW + 6;
  const cw = t.w - cx - pad;
  const screenRadius = round
    ? "50%"
    : t.shape === "arch"
      ? "26px 26px 10px 10px"
      : `${Math.round(scrH * 0.14)}px / ${Math.round(scrH * 0.2)}px`;
  const bodyBg = t.wood
    ? `repeating-linear-gradient(92deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 2px, transparent 2px, transparent 9px), linear-gradient(180deg, ${sh(t.body, 1.12)}, ${t.body} 35%, ${sh(t.body, 0.9)})`
    : `linear-gradient(180deg, ${sh(t.body, 1.12)}, ${t.body} 35%, ${sh(t.body, 0.9)})`;
  const showLegs = t.type === "console" || !!pos.legs;

  return (
    <button
      aria-label="Old television — sign up or log in"
      onClick={onClick}
      className="tv-btn"
      style={{
        ["--glow" as string]: `${t.acc1}88`,
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: t.w,
        height: t.h,
        transform: pos.rot ? `rotate(${pos.rot}deg)` : undefined,
        padding: 0,
        background: egg
          ? `radial-gradient(circle at 32% 26%, ${sh(t.body, 1.35)}, ${t.body} 55%, ${sh(t.body, 0.6)})`
          : bodyBg,
        borderRadius: egg ? "50%" : arch ? "42px 42px 6px 6px" : 6,
        border: "1px solid rgba(255,255,255,0.14)",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "block",
        boxShadow:
          "inset 0 -8px 10px -6px rgba(0,0,0,0.5), inset 0 2px 3px -1px rgba(255,255,255,0.1)",
      }}
    >
      <svg
        width={t.w}
        height={t.h}
        style={{ position: "absolute", left: -1, top: -1, overflow: "visible", pointerEvents: "none" }}
      >
        {!egg && !arch && (
          <>
            <polygon
              points={`4,0 ${t.w - 2},0 ${t.w - 2 + DX},${-DY} ${4 + DX},${-DY}`}
              fill={sh(t.body, 1.35)}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="0.5"
            />
            <line x1="4" y1="0.5" x2={t.w - 2} y2="0.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </>
        )}
        {!egg && (
          <polygon
            points={`${t.w - 1},${arch ? 38 : 2} ${t.w - 1 + DX},${(arch ? 38 : 2) - DY} ${t.w - 1 + DX},${t.h - 4 - DY} ${t.w - 1},${t.h - 4}`}
            fill={sh(t.body, 0.55)}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.5"
          />
        )}
        {!egg &&
          !arch &&
          [0.3, 0.45, 0.6].map((f) => (
            <rect
              key={f}
              x={t.w + 1}
              y={t.h * f}
              width={DX - 4}
              height="2"
              fill="rgba(0,0,0,0.35)"
            />
          ))}
        {showLegs &&
          [0.1, 0.84].map((f) => (
            <g key={f}>
              <polygon
                points={`${f * t.w + 9},${t.h + 1} ${f * t.w + 20},${t.h + 1} ${f * t.w + 18},${t.h + 16} ${f * t.w + 7},${t.h + 16}`}
                fill="#221708"
              />
              <rect x={f * t.w + 7} y={t.h + 13} width="11" height="3" rx="1" fill="#d8b36a" />
            </g>
          ))}
      </svg>
      {!floor && (
        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            top: "100%",
            height: 9,
            background: "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.5), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: egg ? (t.w - eggSize) / 2 : round ? pad + (scrW - dsz) / 2 + 4 : pad,
          top: egg ? Math.round(t.h * 0.1) : round ? pad + (scrH - dsz) / 2 : pad,
          width: egg ? eggSize : round ? dsz : scrW,
          height: egg ? eggSize : round ? dsz : scrH,
          background: t.bezel,
          borderRadius: round ? "50%" : arch ? "32px 32px 9px 9px" : 9,
          border: "1px solid rgba(0,0,0,0.7)",
          boxShadow:
            "inset 0 0 0 1.5px rgba(255,255,255,0.07), inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          className="tv-screen"
          style={{ position: "relative", width: cvSize.w, height: cvSize.h, borderRadius: screenRadius }}
        >
          <canvas
            ref={canvasRef}
            width={Math.max(14, Math.ceil(cvSize.w / NOISE_SCALE))}
            height={Math.max(12, Math.ceil(cvSize.h / NOISE_SCALE))}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: screenRadius,
              display: "block",
              imageRendering: "pixelated",
              background: "#0b0a10",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: screenRadius,
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)",
              boxShadow: "inset 0 0 16px rgba(0,0,0,0.55)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: screenRadius,
              background:
                "radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.13), rgba(255,255,255,0.04) 32%, transparent 55%), radial-gradient(ellipse at 50% 58%, rgba(255,255,255,0.05), transparent 65%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
      {egg && (
        <>
          <div
            style={{
              position: "absolute",
              top: -7,
              left: "50%",
              transform: "translateX(-50%)",
              width: 18,
              height: 8,
              borderRadius: "9px 9px 2px 2px",
              background: sh(t.body, 1.3),
              border: "1px solid rgba(255,255,255,0.2)",
              borderBottom: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 14,
              height: 7,
              background: `linear-gradient(180deg, ${sh(t.body, 0.6)}, ${sh(t.body, 0.4)})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "24%",
              right: "24%",
              height: 9,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at 40% 30%, ${sh(t.body, 0.75)}, ${sh(t.body, 0.4)})`,
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          />
        </>
      )}
      {!egg && (
      <div
        style={{
          position: "absolute",
          left: cx,
          top: arch ? pad + 14 : pad - 2,
          width: cw,
          height: arch ? scrH - 12 : scrH + 4,
          background: t.panel,
          borderRadius: 5,
          border: "1px solid rgba(0,0,0,0.4)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        <Controls t={t} />
        <div style={{ display: "flex", gap: cw < 28 ? 2 : 3, justifyContent: "center", marginTop: 5 }}>
          {[t.acc1, t.acc2, "#d8b36a"].map((c, i) => (
            <div
              key={i}
              style={{
                width: cw < 28 ? 4 : 6,
                height: cw < 28 ? 4 : 6,
                borderRadius: cw < 28 ? 1 : 2,
                background: c,
                border: "1px solid rgba(0,0,0,0.5)",
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 5 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 2,
                background: "rgba(0,0,0,0.5)",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                margin: "3px 4px",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: "20%",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: t.acc1,
            boxShadow: `0 0 4px ${t.acc1}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: "18%",
            right: "18%",
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.35)",
          }}
        />
      </div>
      )}
      {!egg && !arch && (
        <div style={{ position: "absolute", top: 3, left: pad, display: "flex", gap: 4 }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                width: 2,
                height: 5,
                background: "rgba(0,0,0,0.5)",
                borderRight: "1px solid rgba(255,255,255,0.14)",
              }}
            />
          ))}
        </div>
      )}
      {(egg
        ? []
        : arch
          ? ([
              [4, t.h - 9],
              [t.w - 9, t.h - 9],
            ] as const)
          : ([
              [4, 4],
              [t.w - 9, 4],
              [4, t.h - 9],
              [t.w - 9, t.h - 9],
            ] as const)
      ).map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p[0],
            top: p[1],
            width: 3.5,
            height: 3.5,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)",
          }}
        />
      ))}
      {t.id === "a" && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 5,
              border: "1px solid rgba(216,179,106,0.28)",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: pad,
              bottom: 3,
              width: scrW,
              height: 6,
              background: "linear-gradient(90deg, rgba(216,179,106,0.55), rgba(216,179,106,0.12))",
              borderRadius: 2,
            }}
          />
        </>
      )}
      {t.id === "b" && (
        <>
          <div
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              bottom: 2,
              height: 3,
              background: "linear-gradient(180deg, #9aa2b5, #5a6172)",
              borderRadius: 2,
            }}
          />
          <div style={{ position: "absolute", left: pad, bottom: 7, display: "flex", gap: 4 }}>
            {["#c0392b", "#e8e4da", "#e0c56a"].map((c) => (
              <div
                key={c}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: c,
                  border: "1px solid rgba(0,0,0,0.65)",
                }}
              />
            ))}
          </div>
        </>
      )}
      {t.id === "c" && (
        <svg
          width="20"
          height="20"
          style={{ position: "absolute", left: pad, bottom: 2, overflow: "visible" }}
        >
          <g stroke={t.acc1} strokeWidth="1.5" strokeLinecap="round">
            <line x1="10" y1="1" x2="10" y2="19" />
            <line x1="1" y1="10" x2="19" y2="10" />
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </g>
          <circle cx="10" cy="10" r="2.5" fill={t.acc1} />
        </svg>
      )}
      {t.id === "d" && (
        <svg
          width="34"
          height="30"
          style={{ position: "absolute", top: -27, right: 6, overflow: "visible", pointerEvents: "none" }}
        >
          <line x1="6" y1="29" x2="30" y2="3" stroke="#8a8498" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="29" x2="18" y2="16" stroke="#b6b0c4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="30" cy="3" r="2.5" fill={t.acc1} />
        </svg>
      )}
      {t.id === "f" && (
        <>
          <div
            style={{
              position: "absolute",
              right: -4,
              top: "38%",
              width: 7,
              height: 20,
              borderRadius: 3,
              background: sh(t.body, 0.7),
              border: "1px solid rgba(255,255,255,0.22)",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0 1.5px, transparent 1.5px 4px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: pad + 2,
              bottom: 3,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, ${sh(t.acc1, 1.25)}, ${t.acc1} 70%)`,
              border: "2px solid rgba(0,0,0,0.55)",
            }}
          />
        </>
      )}
      {t.id === "g" && (
        <>
          {[45, 135, 225, 315].map((deg) => {
            const bezSize = Math.min(scrW, scrH) + 8;
            const cxq = pad + (scrW - bezSize) / 2 + 4 + bezSize / 2;
            const cyq = pad + (scrH - bezSize) / 2 + bezSize / 2;
            const rr = bezSize / 2 - 2;
            const px = cxq + rr * Math.cos((deg * Math.PI) / 180);
            const py = cyq + rr * Math.sin((deg * Math.PI) / 180);
            return (
              <div
                key={deg}
                style={{
                  position: "absolute",
                  left: px - 2,
                  top: py - 2,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#b6b0c4",
                  border: "1px solid rgba(0,0,0,0.6)",
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 3,
              top: "32%",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: 6, height: 2, background: "rgba(0,0,0,0.5)", borderRadius: 1 }} />
            ))}
          </div>
        </>
      )}
      {t.id === "h" && (
        <>
          {["16%", "74%"].map((l) => (
            <div
              key={l}
              style={{
                position: "absolute",
                top: "100%",
                left: l,
                width: 10,
                height: 3,
                background: "#0d0b10",
                borderRadius: "0 0 2px 2px",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: pad + 1,
              bottom: 3,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#e24b4a",
              boxShadow: "0 0 3px #e24b4a",
            }}
          />
        </>
      )}
      {showLegs &&
        ["10%", "84%"].map((l) => (
          <div
            key={l}
            style={{
              position: "absolute",
              top: "100%",
              left: l,
              width: 13,
              height: 22,
              background: "#221708",
              border: "1px solid rgba(255,255,255,0.18)",
              borderBottom: "3px solid #d8b36a",
              borderRadius: "0 0 4px 4px",
              transform: `skewX(${l === "10%" ? 8 : -8}deg)`,
            }}
          />
        ))}
      {floor && !pos.legs && t.type !== "console" &&
        ["14%", "78%"].map((l) => (
          <div
            key={l}
            style={{
              position: "absolute",
              top: "100%",
              left: l,
              width: 16,
              height: 5,
              background: "#0d0b10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderTop: "none",
              borderRadius: "0 0 3px 3px",
            }}
          />
        ))}
      {t.type === "panel" && (
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 8,
            bottom: 8,
            width: 4,
            background: "rgba(0,0,0,0.35)",
            borderRight: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 2,
          }}
        />
      )}
      {t.type === "portable" && (
        <div
          style={{
            position: "absolute",
            left: "24%",
            right: "36%",
            top: -13,
            height: 13,
            border: `3.5px solid ${sh(t.body, 1.3)}`,
            borderBottom: "none",
            borderRadius: "9px 9px 0 0",
            boxSizing: "border-box",
          }}
        />
      )}
      {t.type === "antenna" && (
        <svg
          viewBox="0 0 100 50"
          width="88"
          height="44"
          style={{ position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)", overflow: "visible" }}
        >
          <line x1="50" y1="50" x2="14" y2="4" stroke="#8a8498" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="50" x2="86" y2="2" stroke="#8a8498" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="14" cy="4" r="3" fill="#b9a5f7" />
          <circle cx="86" cy="2" r="3" fill="#ef99c2" />
          <rect x="40" y="42" width="20" height="10" rx="3" fill="#8a8498" stroke="rgba(0,0,0,0.4)" />
        </svg>
      )}
    </button>
  );
}

const MOBILE_W = 220;
const MOBILE_H = 600;
// Single tower of four, widest at the bottom, antenna set on top.
// Slight tilts + the pink set standing on its own legs keep it casual.
const MOBILE_POS: Record<string, { x: number; y: number; rot: number; legs?: boolean }> = {
  e: { x: 44, y: 54, rot: 1.5 },
  g: { x: 32, y: 160, rot: -2 },
  c: { x: 30, y: 272, rot: 1.5, legs: true },
  a: { x: 10, y: 410, rot: -1 },
};
// Draw bottom TVs first so upper cabinets sit cleanly over lower top faces
const MOBILE_DOM_ORDER = ["a", "c", "g", "e"];

export default function TvPile({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [scale, setScale] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const isMobile = vw < 560;
      setMobile(isMobile);
      if (wrapRef.current) {
        const avail = wrapRef.current.clientWidth;
        // Never scale past what fits the viewport height (no page scroll on desktop or mobile)
        const fitH = (window.innerHeight - 110) / STAGE_H;
        const fitHMobile = (window.innerHeight - 100) / MOBILE_H;
        setScale(
          isMobile
            ? Math.min(1.7, avail / MOBILE_W, fitHMobile)
            : Math.min(1.25, avail / STAGE_W, fitH)
        );
      }
      setReady(true);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let raf = 0;
    let stopped = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      if (stopped) return;
      for (const cv of canvases.current) {
        if (!cv) continue;
        const ctx = cv.getContext("2d");
        if (!ctx) continue;
        const W = cv.width;
        const H = cv.height;
        const img = ctx.createImageData(W, H);
        const d = img.data;
        for (let p = 0; p < W * H; p++) {
          const o = p * 4;
          const v = Math.random();
          let r = 105 + v * 125;
          let g = r;
          let b = r;
          if (Math.random() < 0.2) {
            const c = Math.random();
            const amt = 110;
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
        ctx.putImageData(img, 0, 0);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleClick = (t: TvDef) => {
    if (!signedIn) {
      router.push("/signup");
    } else {
      router.push(t.href ?? "/account");
    }
  };

  const stageW = mobile ? MOBILE_W : STAGE_W;
  const stageH = mobile ? MOBILE_H : STAGE_H;
  const ordered = mobile
    ? MOBILE_DOM_ORDER.map((id) => TVS.find((t) => t.id === id)!)
    : TVS;

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        maxWidth: STAGE_W * 1.25,
        margin: "0 auto",
        height: stageH * scale,
        overflow: "hidden",
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          width: stageW,
          height: stageH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginLeft: Math.max(0, (Math.min(STAGE_W * 1.25, wrapRef.current?.clientWidth ?? stageW * scale) - stageW * scale) / 2),
        }}
      >
        <div style={{ position: "relative", width: stageW, height: stageH }}>
          <div
            style={{
              position: "absolute",
              left: "3%",
              right: "3%",
              bottom: 14,
              height: 42,
              background:
                "radial-gradient(ellipse at center, #201b2e 0%, #17141f 55%, rgba(23,20,31,0) 100%)",
              borderRadius: "50%",
            }}
          />
          <svg
            width={stageW}
            height={stageH}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          >
            {mobile ? (
              <>
                <path
                  d="M204 550 C 218 570, 188 580, 194 592"
                  stroke="#1f1b28"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <rect x="189" y="590" width="10" height="8" rx="2" fill="#1f1b28" />
              </>
            ) : (
              <>
                <path
                  d="M386 566 C 412 584, 398 598, 436 599"
                  stroke="#1f1b28"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <rect x="433" y="594" width="11" height="9" rx="2" fill="#1f1b28" />
              </>
            )}
          </svg>
          {ordered.map((t, i) => (
            <Tv
              key={t.id}
              t={t}
              pos={mobile ? MOBILE_POS[t.id] : { x: t.x, y: t.y }}
              floor={mobile ? t.id === "a" || !!MOBILE_POS[t.id]?.legs : !!t.floor}
              onClick={() => handleClick(t)}
              canvasRef={(el) => {
                canvases.current[i] = el;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
