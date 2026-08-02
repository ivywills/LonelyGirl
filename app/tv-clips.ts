// 80s SYNTHWAVE "channel" clips for the four linked CRTs in the TV pile.
// Each linked TV loops a lo-fi vector clip that hints at its destination page:
//   b -> /playlists  (spinning record + EQ bars)
//   c -> /events     (sweeping spotlights, stage line, jumping crowd)
//   e -> /chat       (popping speech bubbles with typing dots)
//   g -> /shop       (bobbing merch tee + swinging price tag)
//
// Authored for SMALL backing-store canvases (~40-90px) drawn with
// `image-rendering: pixelated`, exactly like the existing TV static. Keep the
// canvas width/height you already use for the static noise. All drawing is
// resolution-relative (uses W/H), so it scales, but line weights are tuned for
// the small size — bump the canvas resolution only if you want crisper clips.

export type ChannelId = "b" | "c" | "e" | "g";
type Ctx = CanvasRenderingContext2D;
type Pal = { hot: string; cool: string; a: string; b: string };

// Per-channel accent pair, lifted verbatim from each TV's acc1/acc2 in TVS.
const ACCENTS: Record<ChannelId, { hot: string; cool: string }> = {
  b: { hot: "#ffe08a", cool: "#eaf3fb" }, // Playlists
  c: { hot: "#ef99c2", cool: "#8fb1ff" }, // Events
  e: { hot: "#b9a5f7", cool: "#ef99c2" }, // Chat
  g: { hot: "#7de3d0", cool: "#e0c56a" }, // Shop
};

const LINKED = new Set<string>(["b", "c", "e", "g"]);
export const isLinkedChannel = (id: string): id is ChannelId => LINKED.has(id);

/**
 * Paint one animated frame of a channel clip.
 * @param time      seconds since start (e.g. (performance.now() - start) / 1000)
 * @param intensity 0..1 scanline strength (default 0.6)
 */
export function drawClip(
  ctx: Ctx,
  W: number,
  H: number,
  id: ChannelId,
  time: number,
  intensity = 0.6,
) {
  const acc = ACCENTS[id] ?? ACCENTS.b;
  const p: Pal = { hot: acc.hot, cool: acc.cool, a: acc.hot, b: acc.cool };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  // Shop is the one channel without a sun — it sits right behind the tee
  bgSynth(ctx, W, H, time, id !== "g");
  if (id === "b") subjRecord(ctx, W, H, time, p);
  else if (id === "c") subjEvents(ctx, W, H, time, p);
  else if (id === "e") subjChat(ctx, W, H, time, p);
  else if (id === "g") subjShop(ctx, W, H, time, p);
  fxSynth(ctx, W, H, time, intensity);
  ctx.restore();
}

/**
 * The existing TV static (unchanged from the current inline loop) — use this
 * for the non-linked TVs so they behave exactly as before.
 */
export function drawStatic(ctx: Ctx, W: number, H: number) {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let pp = 0; pp < W * H; pp++) {
    const o = pp * 4;
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
      else if (c < 0.75) { r = Math.min(255, r + amt); b = Math.min(255, b + amt); }
      else if (c < 0.9) { g = Math.min(255, g + amt); b = Math.min(255, b + amt); }
      else { r = Math.min(255, r + amt); g = Math.min(255, g + amt * 0.7); }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx: Ctx, cx: number, cy: number, R: number, col: string, t: number) {
  const r2 = R * 0.44;
  const rot = t * 0.6;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r2 : R;
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Shared synthwave backdrop + post FX
// ---------------------------------------------------------------------------
/** `sun` off leaves the sky bare — the shop tee needs the room behind it. */
function bgSynth(ctx: Ctx, W: number, H: number, time: number, sun = true) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#160a2e"); g.addColorStop(0.58, "#41123f"); g.addColorStop(1, "#12071f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const hy = Math.round(H * 0.6);
  if (sun) {
    const sr = H * 0.26;
    const sx = W / 2;
    const sg = ctx.createLinearGradient(0, hy - sr, 0, hy);
    sg.addColorStop(0, "#ffd24d"); sg.addColorStop(0.5, "#ff5db1"); sg.addColorStop(1, "#c13aa0");
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, hy, sr, Math.PI, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(sx - sr, hy - sr, sr * 2, sr);
    ctx.fillStyle = "#160a2e";
    for (let i = 1; i < 5; i++) { const yy = hy - i * (sr * 0.19); ctx.fillRect(sx - sr, yy, sr * 2, Math.max(1, i * 0.5)); }
    ctx.restore();
  }

  const gg = ctx.createLinearGradient(0, hy, 0, H);
  gg.addColorStop(0, "#1a0b2e"); gg.addColorStop(1, "#2c0f42");
  ctx.fillStyle = gg; ctx.fillRect(0, hy, W, H - hy);

  const span = H - hy;
  ctx.lineWidth = 1; ctx.strokeStyle = "#ff36c4";
  for (let i = 0; i < 9; i++) {
    const f = ((i / 9) + (time * 0.16)) % 1;
    const y = hy + f * f * span;
    ctx.globalAlpha = 0.18 + 0.72 * f;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.globalAlpha = 0.5; ctx.strokeStyle = "#00e6ff";
  for (let i = -4; i <= 4; i++) {
    const bx = W / 2 + i * (W * 0.17);
    ctx.beginPath(); ctx.moveTo(W / 2, hy); ctx.lineTo(bx, H); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = "#ff9df0";
  ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
}

function fxSynth(ctx: Ctx, W: number, H: number, time: number, I: number) {
  ctx.fillStyle = "rgba(120,80,200,0.05)"; ctx.fillRect(0, 0, W, H);
  const by = (time * H * 0.2) % H;
  ctx.fillStyle = "rgba(255,190,255," + (0.04 + 0.05 * I) + ")"; ctx.fillRect(0, by, W, 1);
}

// ---------------------------------------------------------------------------
// Per-channel subjects
// ---------------------------------------------------------------------------

/** Playlists — spinning vinyl + bouncing EQ bars. (No tonearm, by design.) */
function subjRecord(ctx: Ctx, W: number, H: number, time: number, p: Pal) {
  const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.32;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 2.1);
  ctx.fillStyle = "#0c0c12"; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 0.6;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, R * (0.42 + i * 0.16), 0, 7); ctx.stroke(); }
  ctx.strokeStyle = p.cool; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.95, 0); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = p.hot; ctx.beginPath(); ctx.arc(0, 0, R * 0.34, 0, 7); ctx.fill();
  ctx.fillStyle = "#0c0c12"; ctx.beginPath(); ctx.arc(0, 0, R * 0.08, 0, 7); ctx.fill();
  ctx.restore();

  const n = 5;
  for (let i = 0; i < n; i++) {
    const bw = (W - 4) / n, bx = 2 + i * bw;
    const bh = 2 + Math.abs(Math.sin(time * 5 + i * 0.9)) * (H * 0.17);
    ctx.fillStyle = i % 2 ? p.cool : p.hot;
    ctx.fillRect(bx, H - 2 - bh, bw - 1, bh);
  }
}

/** Events — sweeping spotlights, stage line, and a row of 5 jumping people. */
function subjEvents(ctx: Ctx, W: number, H: number, time: number, p: Pal) {
  const hy = H * 0.78;
  const sweep = Math.sin(time * 1.6) * 0.5;
  const beam = (ox: number, dir: number, col: string) => {
    ctx.save(); ctx.globalAlpha = 0.5;
    const grd = ctx.createLinearGradient(ox, 0, ox, hy);
    grd.addColorStop(0, col); grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    const aim = W / 2 + dir * W * 0.16 + sweep * W * 0.5 * dir;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(aim - W * 0.13, hy); ctx.lineTo(aim + W * 0.13, hy); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  beam(W * 0.16, -1, p.hot);
  beam(W * 0.84, 1, p.cool);

  ctx.fillStyle = "#180a2b"; ctx.fillRect(0, hy, W, H - hy);
  ctx.strokeStyle = "#00e6ff"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();

  // Five evenly-spaced silhouettes. Same jump HEIGHT (0.16 * H), staggered phase.
  ctx.fillStyle = "#08040f";
  [0.2, 0.35, 0.5, 0.65, 0.8].forEach((fxr, i) => {
    const hop = Math.abs(Math.sin(time * 3.2 + i * 1.1)) * H * 0.16;
    const top = hy - H * 0.16 - hop;
    const fx = W * fxr;
    ctx.fillRect(fx - 2, top, 4, H * 0.16);
    ctx.beginPath(); ctx.arc(fx, top - 1, 2.1, 0, 7); ctx.fill();
  });
}

/** Chat — two speech bubbles popping in on a 3s cycle with typing dots. */
function subjChat(ctx: Ctx, W: number, H: number, time: number, p: Pal) {
  const cyc = time % 3;
  const aP = Math.min(1, Math.max(0, (cyc - 0.1) * 3.2));
  const bP = Math.min(1, Math.max(0, (cyc - 1.5) * 3.2));
  bubble(ctx, W * 0.08, H * 0.14, W * 0.52, H * 0.3, p.a, "left", aP, time, cyc < 1.4);
  bubble(ctx, W * 0.4, H * 0.54, W * 0.52, H * 0.3, p.b, "right", bP, time, cyc >= 1.4);
}

function bubble(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  col: string, tail: "left" | "right", prog: number, time: number, typing: boolean,
) {
  if (prog <= 0) return;
  ctx.save();
  const cx = x + w / 2, cy = y + h / 2;
  ctx.translate(cx, cy); ctx.scale(prog, prog); ctx.translate(-cx, -cy);
  // tail
  ctx.beginPath();
  if (tail === "left") { ctx.moveTo(x + 3, y + h - 1); ctx.lineTo(x, y + h + 3); ctx.lineTo(x + 8, y + h - 1); }
  else { ctx.moveTo(x + w - 3, y + h - 1); ctx.lineTo(x + w, y + h + 3); ctx.lineTo(x + w - 8, y + h - 1); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.8; ctx.stroke();
  // body
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 0.6;
  roundRect(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6, 2.4); ctx.stroke();
  // typing dots
  for (let i = 0; i < 3; i++) {
    const on = typing ? (Math.floor(time * 4) % 3 === i) : true;
    ctx.globalAlpha = on ? 1 : 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.arc(x + w * 0.28 + i * w * 0.22, y + h * 0.5, on ? 1.5 : 1.05, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Shop — a bobbing deep-blue merch sweater and a swinging price tag. */
function subjShop(ctx: Ctx, W: number, H: number, time: number, p: Pal) {
  const cx = W / 2, cy = H * 0.52, bob = Math.sin(time * 2) * 1.2, s = Math.min(W, H);
  ctx.save(); ctx.translate(cx, cy + bob); ctx.rotate(Math.sin(time * 1.3) * 0.07);
  // Deep blue knit; the darker tone does the cuffs, hem and collar ribbing
  const knit = "#2f4db3";
  const rib = "#1f3379";
  const bw = s * 0.3, bh = s * 0.46;
  const y0 = -bh * 0.18;
  // torso
  ctx.fillStyle = knit;
  roundRect(ctx, -bw / 2, y0, bw, bh, 2); ctx.fill();
  // long sleeves, tapering down beside the body to ribbed cuffs
  ctx.beginPath(); ctx.moveTo(-bw / 2, y0); ctx.lineTo(-bw / 2 - s * 0.16, y0 + bh * 0.16); ctx.lineTo(-bw / 2 - s * 0.12, y0 + bh * 0.92); ctx.lineTo(-bw / 2 - s * 0.02, y0 + bh * 0.86); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bw / 2, y0); ctx.lineTo(bw / 2 + s * 0.16, y0 + bh * 0.16); ctx.lineTo(bw / 2 + s * 0.12, y0 + bh * 0.92); ctx.lineTo(bw / 2 + s * 0.02, y0 + bh * 0.86); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rib;
  // cuffs
  ctx.fillRect(-bw / 2 - s * 0.125, y0 + bh * 0.84, s * 0.105, bh * 0.1);
  ctx.fillRect(bw / 2 + s * 0.02, y0 + bh * 0.84, s * 0.105, bh * 0.1);
  // hem ribbing
  ctx.fillRect(-bw / 2, y0 + bh * 0.86, bw, bh * 0.14);
  // ribbed crew collar — no star on the chest, plain knit
  ctx.beginPath(); ctx.arc(0, y0, bw * 0.2, 0, Math.PI); ctx.fill();
  ctx.fillStyle = "#0c0c12"; ctx.beginPath(); ctx.arc(0, y0, bw * 0.13, 0, Math.PI); ctx.fill();
  ctx.restore();
  // price tag on a string
  ctx.save(); ctx.translate(W * 0.76, H * 0.2); ctx.rotate(Math.sin(time * 2.4) * 0.4 - 0.4);
  ctx.strokeStyle = "#d9d3e6"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
  ctx.translate(0, 5); ctx.rotate(0.5);
  ctx.fillStyle = p.b; roundRect(ctx, 0, 0, 7, 5, 1); ctx.fill();
  ctx.fillStyle = "#0c0c12"; ctx.beginPath(); ctx.arc(1.5, 1.5, 0.7, 0, 7); ctx.fill();
  ctx.restore();
}
