"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lobster } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { ROOM_COLORS } from "@/app/chat/rooms-client";

const lobster = Lobster({ subsets: ["latin"], weight: "400" });

export type PlaylistRow = {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  apple_url: string;
  color: string;
  song_count: number;
  note: string;
};

type Phys = {
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  seed: number;
  phase: "wait" | "active";
  release: number;
};

const APPLE_BROWSE = "https://music.apple.com/us/browse";
const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
// Links come from whatever the creator pasted, so never hand a stored string
// straight to href — anything that isn't http(s) falls back to Apple's browse page
const safeUrl = (s: string) => (isUrl(s) ? s.trim() : APPLE_BROWSE);
const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;

/* ---- record maths ---- */

function sh(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Bigger playlist, bigger record — square-rooted so a 100-song list doesn't
// dwarf a 10-song one
function radius(count: number) {
  const c = Math.max(1, Math.min(140, Number(count) || 1));
  return Math.round(13 + Math.sqrt(c / 140) * 36);
}

function discBg() {
  const grooves =
    "repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.44) 0px, rgba(0,0,0,0.44) 0.4px, rgba(255,255,255,0.055) 0.9px, rgba(255,255,255,0.055) 1.8px)";
  const bands =
    "repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 6.5px, rgba(0,0,0,0.34) 7px, rgba(0,0,0,0) 8.4px)";
  const gloss =
    "conic-gradient(from 205deg at 50% 50%, rgba(255,255,255,0.11), rgba(255,255,255,0) 18%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.09) 80%, rgba(255,255,255,0) 100%)";
  const spec =
    "radial-gradient(circle at 34% 26%, rgba(255,255,255,0.36), rgba(255,255,255,0) 30%)";
  const base =
    "radial-gradient(circle at 38% 30%, #3d3d47 0%, #1b1b22 44%, #090a0e 100%)";
  return `${spec}, ${gloss}, ${bands}, ${grooves}, ${base}`;
}

function labelBg(color: string) {
  const rings =
    "repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 0.5px, rgba(255,255,255,0.08) 1.4px, rgba(255,255,255,0.08) 2.6px)";
  return `${rings}, radial-gradient(circle at 42% 36%, ${sh(color, 1.24)}, ${color} 60%, ${sh(color, 0.8)} 100%)`;
}

// Nothing reads the count from Apple Music yet, so it's whatever the creator
// typed — never guessed on their behalf
function parseCount(raw: string) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function PlaylistsClient({
  rows,
  userId,
  displayName,
}: {
  rows: PlaylistRow[];
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>(rows);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    url: "",
    count: "",
    color: ROOM_COLORS[11],
    note: "",
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, { wrap: HTMLButtonElement | null; disc: HTMLDivElement | null }>>({});
  const phys = useRef<Record<string, Phys>>({});
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;
  const seedIds = useRef(rows.map((r) => r.id));
  const startRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  // Records fall in, bump off each other and settle into a pile. Everything
  // runs on refs inside one rAF loop — no state, so no re-render per frame.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ensurePhys = (id: string, now: number, W: number) => {
      if (phys.current[id]) return;
      const pl = playlistsRef.current.find((p) => p.id === id);
      if (!pl) return;
      const r = radius(pl.song_count);
      const x = r + 14 + Math.random() * Math.max(1, W - 2 * r - 28);
      const idx = seedIds.current.indexOf(id);
      const release =
        idx >= 0 && startRef.current != null
          ? startRef.current + idx * 130 + Math.random() * 80
          : now + 40;
      phys.current[id] = {
        r,
        x,
        // Reduced motion: start where it would have landed, no drop
        y: reduced ? r + 14 : -r - 20 - Math.random() * 220,
        vx: (Math.random() * 2 - 1) * 16,
        vy: 0,
        angle: Math.random() * 360,
        seed: Math.random() * 6.28,
        phase: reduced ? "active" : "wait",
        release: reduced ? now : release,
      };
    };

    let raf = 0;
    lastRef.current = performance.now();
    const frame = (now: number) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      if (W && H) {
        if (startRef.current == null) startRef.current = now + 200;
        let dt = (now - lastRef.current) / 1000;
        lastRef.current = now;
        if (dt > 0.05) dt = 0.05;
        const g = 1500;
        const active: Phys[] = [];
        for (const pl of playlistsRef.current) {
          ensurePhys(pl.id, now, W);
          const p = phys.current[pl.id];
          if (!p) continue;
          if (p.phase === "wait" && now >= p.release) p.phase = "active";
          active.push(p);
        }
        for (const p of active) {
          if (p.phase !== "active") continue;
          p.vy += g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        for (let it = 0; it < 3; it++) {
          for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
              const a = active[i];
              const b = active[j];
              if (a.phase !== "active" || b.phase !== "active") continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.hypot(dx, dy);
              const min = a.r + b.r;
              if (d > 0 && d < min) {
                const nx = dx / d;
                const ny = dy / d;
                const ov = min - d;
                a.x -= (nx * ov) / 2;
                a.y -= (ny * ov) / 2;
                b.x += (nx * ov) / 2;
                b.y += (ny * ov) / 2;
                const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rel < 0) {
                  const imp = rel * 0.35;
                  a.vx += nx * imp;
                  a.vy += ny * imp;
                  b.vx -= nx * imp;
                  b.vy -= ny * imp;
                }
              }
            }
          }
          for (const p of active) {
            if (p.phase !== "active") continue;
            if (p.x < p.r) {
              p.x = p.r;
              p.vx = Math.abs(p.vx) * 0.4;
            } else if (p.x > W - p.r) {
              p.x = W - p.r;
              p.vx = -Math.abs(p.vx) * 0.4;
            }
            if (p.y > H - p.r) {
              p.y = H - p.r;
              p.vy = -Math.abs(p.vy) * 0.2;
            }
          }
        }
        for (const pl of playlistsRef.current) {
          const p = phys.current[pl.id];
          const ref = els.current[pl.id];
          if (!p || !ref?.wrap) continue;
          if (p.phase === "wait") {
            ref.wrap.style.opacity = "0";
            continue;
          }
          const grounded = p.y >= H - p.r - 1.5;
          if (grounded && !reduced) {
            // Idle shuffle: the pile never quite stops fidgeting
            p.vx += Math.sin(now / 950 + p.seed) * 5 * dt + (Math.random() * 2 - 1) * 7 * dt;
            p.vx *= 0.9;
            if (p.vx > 8) p.vx = 8;
            else if (p.vx < -8) p.vx = -8;
          } else {
            p.vx *= 0.99;
          }
          p.angle += (p.vx / p.r) * 57.3 * dt;
          ref.wrap.style.opacity = "1";
          ref.wrap.style.transform = `translate(${p.x - p.r}px,${p.y - p.r}px)`;
          if (ref.disc) ref.disc.style.transform = `rotate(${p.angle}deg)`;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const previewCount = parseCount(form.count);
  const ready = !!form.name.trim() && previewCount > 0;
  const selected = playlists.find((p) => p.id === selectedId) ?? null;
  const mono = (t: string) => (t || "?").trim().charAt(0).toUpperCase() || "?";

  async function submitAdd() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("playlists")
      .insert({
        creator_id: userId,
        creator_name: displayName,
        title: form.name.trim(),
        apple_url: safeUrl(form.url),
        color: form.color,
        song_count: previewCount,
        note: form.note.trim(),
      })
      .select("id, creator_id, creator_name, title, apple_url, color, song_count, note")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? "Could not add that record.");
      return;
    }
    setPlaylists((prev) => [...prev, data as PlaylistRow]);
    setAdding(false);
    setForm((f) => ({ name: "", url: "", count: "", color: f.color, note: "" }));
  }

  async function removeRecord(pl: PlaylistRow) {
    if (!confirm(`Take "${pl.title}" off the wall?`)) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("playlists").delete().eq("id", pl.id);
    if (err) {
      setError(err.message);
      return;
    }
    delete phys.current[pl.id];
    delete els.current[pl.id];
    setSelectedId(null);
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
  }

  const pinkBtn: React.CSSProperties = {
    color: "#fff",
    background: "linear-gradient(135deg, #fb5c74, #fa233b)",
    boxShadow: "0 8px 22px -10px rgba(250,35,59,0.8)",
  };

  return (
    <div
      ref={stageRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 22%, color-mix(in srgb, var(--accent) 12%, var(--bg)), var(--bg) 60%)",
        color: "var(--text)",
      }}
    >
      {/* the wall of records */}
      {playlists.map((pl) => {
        const r = radius(pl.song_count);
        const labelD = Math.round(2 * r * 0.4);
        return (
          <button
            key={pl.id}
            type="button"
            ref={(el) => {
              els.current[pl.id] = { ...els.current[pl.id], wrap: el };
            }}
            onClick={() => setSelectedId(pl.id)}
            aria-label={`${pl.title} — ${songs(pl.song_count)} by ${pl.creator_name || "someone"}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 2 * r,
              height: 2 * r,
              padding: 0,
              border: "none",
              borderRadius: "50%",
              background: "transparent",
              opacity: 0,
              cursor: "pointer",
              userSelect: "none",
              willChange: "transform",
              filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.45))",
            }}
          >
            <div
              ref={(el) => {
                els.current[pl.id] = { ...els.current[pl.id], disc: el };
              }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: discBg(),
                boxShadow:
                  "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 24px rgba(0,0,0,0.55)",
                willChange: "transform",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: labelD,
                  height: labelD,
                  transform: "translate(-50%,-50%)",
                  borderRadius: "50%",
                  background: labelBg(pl.color),
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.22)",
                }}
              />
            </div>
            {/* spindle hole — stays put while the disc spins */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 8,
                height: 8,
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: "#14111b",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                pointerEvents: "none",
                background:
                  "linear-gradient(125deg, rgba(255,255,255,0.20), transparent 32%, transparent 66%, rgba(255,255,255,0.06))",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                pointerEvents: "none",
                boxShadow:
                  "inset 0 1.5px 1px rgba(255,255,255,0.18), inset 0 -2px 4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.5)",
              }}
            />
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          position: "absolute",
          top: 20,
          left: 24,
          zIndex: 6,
          fontSize: 13,
          width: "auto",
          padding: 0,
          background: "transparent",
          border: "none",
          fontWeight: 400,
          color: "var(--accent)",
          cursor: "pointer",
        }}
      >
        change the channel
      </button>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "15%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <button
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          style={{
            pointerEvents: "auto",
            width: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 22px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
            background: "var(--accent)",
            color: "#131316",
            boxShadow:
              "0 14px 32px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          <span className="msr" style={{ fontSize: 20 }} aria-hidden>
            add_circle
          </span>
          Add playlist
        </button>
        {playlists.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Nothing on the wall yet — drop the first record.
          </p>
        )}
      </div>

      {/* record popup */}
      {selected && (
        <div
          onClick={() => setSelectedId(null)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 25,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(10,8,14,0.62)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320,
              maxWidth: "92%",
              borderRadius: 20,
              overflow: "hidden",
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 2,
                width: 30,
                height: 30,
                padding: 0,
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.35)",
                color: "#fff",
              }}
            >
              <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                close
              </span>
            </button>
            {selected.creator_id === userId && (
              <button
                onClick={() => removeRecord(selected)}
                aria-label="Take this record off the wall"
                title="Take this record off the wall"
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: 2,
                  width: 30,
                  height: 30,
                  padding: 0,
                  border: "none",
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.35)",
                  color: "#fff",
                }}
              >
                <span className="msr" style={{ fontSize: 17 }} aria-hidden>
                  delete
                </span>
              </button>
            )}
            <div
              style={{
                padding: "24px 24px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 14,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: discBg(),
                  boxShadow:
                    "0 16px 34px -16px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                <span className={lobster.className} style={{ fontSize: 52, color: "#fff8ee" }}>
                  {mono(selected.title)}
                </span>
              </div>
              <div className={lobster.className} style={{ fontSize: 27, lineHeight: 1.05 }}>
                {selected.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                Made by{" "}
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {selected.creator_name || "someone"}
                </span>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 10,
                  fontSize: 13,
                }}
              >
                <span className="msr" style={{ fontSize: 16, color: "var(--muted)" }} aria-hidden>
                  album
                </span>
                {songs(selected.song_count)}
              </div>
              {selected.note && (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--muted)",
                    margin: "12px 0 0",
                    fontStyle: "italic",
                  }}
                >
                  “{selected.note}”
                </p>
              )}
              {error && (
                <p className="msg-error" style={{ margin: "14px 0 0" }}>
                  {error}
                </p>
              )}
              <a
                href={safeUrl(selected.apple_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: 11,
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  ...pinkBtn,
                }}
              >
                <span className="msr" style={{ fontSize: 19 }} aria-hidden>
                  play_circle
                </span>
                Open in Apple Music
              </a>
            </div>
          </div>
        </div>
      )}

      {/* add form */}
      {adding && (
        <div
          onClick={() => setAdding(false)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(10,8,14,0.62)",
            backdropFilter: "blur(3px)",
            overflow: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 380,
              maxWidth: "94%",
              borderRadius: 20,
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: discBg(),
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 14px rgba(0,0,0,0.5)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 22,
                    height: 22,
                    transform: "translate(-50%,-50%)",
                    borderRadius: "50%",
                    background: labelBg(form.color),
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 5,
                    height: 5,
                    transform: "translate(-50%,-50%)",
                    borderRadius: "50%",
                    background: "#14111b",
                  }}
                />
              </div>
              <div>
                <div className={lobster.className} style={{ fontSize: 22 }}>
                  New record
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {previewCount > 0
                    ? `${songs(previewCount)} · ${2 * radius(previewCount)}px record`
                    : "the longer the playlist, the bigger the record"}
                </div>
              </div>
            </div>

            {error && <p className="msg-error">{error}</p>}

            <label>Playlist name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={60}
              placeholder="3am feelings"
            />
            <label>Apple Music playlist link</label>
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://music.apple.com/…"
            />
            <label>Record colour</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {ROOM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  aria-label={`Colour ${c}`}
                  style={{
                    width: 30,
                    height: 30,
                    padding: 0,
                    borderRadius: "50%",
                    cursor: "pointer",
                    background: c,
                    border: c === form.color ? "2px solid var(--accent)" : "1px solid var(--border)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label>Songs</label>
                <input
                  type="number"
                  min={1}
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                  placeholder="how many?"
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 3 }}>
                <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
                  This sets how big the record lands.
                </span>
              </div>
            </div>
            <label>
              A short note <span style={{ opacity: 0.6 }}>(optional)</span>
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              maxLength={140}
              placeholder="for the walk home when it's raining"
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setAdding(false)}
                style={{
                  width: "auto",
                  padding: "11px 18px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={submitAdd}
                disabled={busy || !ready}
                style={{ flex: 1, opacity: ready ? 1 : 0.5 }}
              >
                {busy ? "Dropping…" : "Drop the record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
