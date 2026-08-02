/*
 * Cuts public/final_tv_color.png into rigid layers for the home page:
 *
 *   final_tv_alpha_a.png — coverage masks for TVs 0-3, one per RGBA channel
 *   final_tv_alpha_b.png — coverage masks for TVs 4-7
 *   final_tv_plate.png   — wall + floor with every TV inpainted away
 *   final_tv_glint.png    — blurred luminance, the photo's glass reflections
 *
 * WHY LAYERS AND NOT A DEPTH MAP. A depth map makes the parallax a per-pixel
 * re-read of one image, so a silhouette is a cliff in the displacement field
 * and boundary pixels get stretched across it — the corners visibly gliding
 * off the sets. Here each TV is instead a rigid sprite that translates as a
 * unit, which makes detached corners geometrically impossible, and the gap a
 * shift opens shows the plate: real wall, not smeared TV. Only the wall and
 * floor are still warped, and being smooth gradients they have no edges to
 * tear.
 *
 * Everything scene-specific comes from lib/tv-wall-config.mjs.
 * Uses `sips` (macOS) to get raw pixels; no image dependencies.
 * Run with: npm run layers
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { TVS, STROKES } from "../lib/tv-wall-config.mjs";

const root = process.cwd();
const COLOR = path.join(root, "public", "final_tv_color.png");
const out = (name) => path.join(root, "public", name);

/* ------------------------------------------------------------ tuning ---- */

const CHROMA_BG = 24; // max channel spread for "neutral" — the flood medium
// Inside a hit zone the flood also needs brightness, so the dark crevices
// where sets stack stay with the TVs while lit wall corners still escape.
const MIN_BRIGHT_IN_ZONE = 140;
const NEAREST_ZONE_CAP = 0.05; // colored pixels farther than this stay wall
const MIN_ISLAND = 400; // px² — smaller zone-less blobs are wall grain

const MASK_FEATHER = 1.2; // px of blur on the masks; bilinear does the rest
const PLATE_GRAIN = 3.6; // levels of noise added back to the inpainted holes
const GLINT_BLUR = 8;

/* --------------------------------------------------- raw pixels via sips - */

const bmpPath = path.join(tmpdir(), `lonelygirl-layers-${process.pid}.bmp`);
execFileSync("sips", ["-s", "format", "bmp", COLOR, "--out", bmpPath], { stdio: "ignore" });
const bmp = readFileSync(bmpPath);
rmSync(bmpPath);

const dataOffset = bmp.readUInt32LE(10);
const W = bmp.readInt32LE(18);
const rawH = bmp.readInt32LE(22);
const H = Math.abs(rawH);
const topDown = rawH < 0;
const bpp = bmp.readUInt16LE(28) / 8;
const stride = Math.ceil((W * bpp) / 4) * 4;

const rgb = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) {
  const row = topDown ? y : H - 1 - y;
  for (let x = 0; x < W; x++) {
    const i = dataOffset + row * stride + x * bpp; // BGR(A)
    const o = (y * W + x) * 3;
    rgb[o] = bmp[i + 2];
    rgb[o + 1] = bmp[i + 1];
    rgb[o + 2] = bmp[i];
  }
}

/* ----------------------------------------------------------- segment ---- */

const zones = TVS.map((tv) => tv.zone);

const zoneAt = new Int8Array(W * H);
for (let y = 0; y < H; y++) {
  const v = y / H;
  for (let x = 0; x < W; x++) {
    const u = x / W;
    let found = -1;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (u >= z.x && u <= z.x + z.w && v >= z.y && v <= z.y + z.h) {
        found = i;
        break;
      }
    }
    zoneAt[y * W + x] = found;
  }
}

function nearestZone(u, v) {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const dx = Math.max(z.x - u, 0, u - (z.x + z.w));
    const dy = Math.max(z.y - v, 0, v - (z.y + z.h));
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return bestDist <= NEAREST_ZONE_CAP ? best : -1;
}

// The wall, the floor and every shadow resting on them are near-grayscale at
// any brightness; the TVs are saturated plastic and wood. Flooding inward
// from the borders across neutral pixels therefore carves out the sets —
// following their true rounded corners, which stamping the rectangular hit
// zones never could. Enclosed neutral regions (static screens, silver control
// panels) are unreachable from the border, so they stay part of their TV.
const isBackground = new Uint8Array(W * H);
{
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  const passable = (x, y) => {
    const o = (y * W + x) * 3;
    const r = rgb[o];
    const g = rgb[o + 1];
    const b = rgb[o + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > CHROMA_BG) return false;
    if (zoneAt[y * W + x] >= 0 && Math.min(r, g, b) < MIN_BRIGHT_IN_ZONE) return false;
    return true;
  };
  const push = (x, y) => {
    const i = y * W + x;
    if (!isBackground[i] && passable(x, y)) {
      isBackground[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
}

// Colour grain in the wall leaves stray non-neutral specks that the flood
// can't enter. A real TV region is either large or overlaps its hit zone, so
// anything small and zone-less goes back to being wall.
{
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (isBackground[start] || seen[start]) continue;
    const members = [];
    let touchesZone = false;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      members.push(i);
      if (zoneAt[i] >= 0) touchesZone = true;
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0 && !isBackground[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < W - 1 && !isBackground[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !isBackground[i - W] && !seen[i - W]) { seen[i - W] = 1; stack.push(i - W); }
      if (y < H - 1 && !isBackground[i + W] && !seen[i + W]) { seen[i + W] = 1; stack.push(i + W); }
    }
    if (!touchesZone && members.length < MIN_ISLAND) {
      for (const i of members) isBackground[i] = 1;
    }
  }
}

// Assign every TV pixel to one of the eight sets. Stacked TVs touch, so the
// hit-zone rectangles are what separate them; the cut lands on the contact
// seam, where both layers move nearly alike and the split is invisible.
const owner = new Int8Array(W * H).fill(-1);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (isBackground[i]) continue;
    owner[i] = zoneAt[i] >= 0 ? zoneAt[i] : nearestZone(x / W, y / H);
  }
}

// Aerials: thin, gray, and therefore flooded as wall. Stamp them into their
// set's mask so they travel with it.
for (const s of STROKES) {
  const x0 = s.x0 * W;
  const y0 = s.y0 * H;
  const x1 = s.x1 * W;
  const y1 = s.y1 * H;
  const r = s.w / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - r - 1)); y <= Math.min(H - 1, Math.ceil(Math.max(y0, y1) + r + 1)); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1)); x <= Math.min(W - 1, Math.ceil(Math.max(x0, x1) + r + 1)); x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lenSq));
      if (Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= r) {
        const i = y * W + x;
        isBackground[i] = 0;
        owner[i] = s.tv;
      }
    }
  }
}

/* -------------------------------------------------------------- masks --- */

function boxBlur(src, radius, w = W, h = H) {
  if (radius <= 0) return src;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[y * w + Math.max(0, Math.min(w - 1, x + k))];
      tmp[y * w + x] = acc * norm;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[Math.max(0, Math.min(h - 1, y + k)) * w + x];
      dst[y * w + x] = acc * norm;
    }
  return dst;
}

const masks = [];
for (let layer = 0; layer < TVS.length; layer++) {
  const m = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = owner[i] === layer ? 255 : 0;
  // A touch of feather so bilinear sampling antialiases the silhouette
  // instead of leaving it stair-stepped once it starts moving.
  masks.push(boxBlur(m, MASK_FEATHER));
}

/* -------------------------------------------------------------- plate --- */

/*
 * Inpaint the wall and floor behind the sets. The background is smooth — a
 * flat wall, one big soft cast shadow, a floor gradient — so diffusing the
 * known pixels inward at quarter resolution and upsampling reconstructs it
 * convincingly, and the result is only ever visible in the sliver a tilt
 * opens up.
 */
const plate = new Uint8ClampedArray(W * H * 3);
{
  const w = Math.ceil(W / PLATE_SCALE);
  const h = Math.ceil(H / PLATE_SCALE);
  const small = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  const known = new Uint8Array(w * h);

  // Downsample, averaging only the pixels we actually know.
  const sum = [new Float64Array(w * h), new Float64Array(w * h), new Float64Array(w * h)];
  const count = new Int32Array(w * h);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isBackground[i]) continue;
      const j = ((y / PLATE_SCALE) | 0) * w + ((x / PLATE_SCALE) | 0);
      const o = i * 3;
      sum[0][j] += rgb[o];
      sum[1][j] += rgb[o + 1];
      sum[2][j] += rgb[o + 2];
      count[j]++;
    }
  }
  for (let j = 0; j < w * h; j++) {
    if (count[j] > 0) {
      known[j] = 1;
      for (let c = 0; c < 3; c++) small[c][j] = sum[c][j] / count[j];
    }
  }

  // Seed the holes with the image mean so diffusion converges quickly.
  let seedR = 0, seedG = 0, seedB = 0, seedN = 0;
  for (let j = 0; j < w * h; j++) {
    if (!known[j]) continue;
    seedR += small[0][j]; seedG += small[1][j]; seedB += small[2][j]; seedN++;
  }
  for (let j = 0; j < w * h; j++) {
    if (known[j]) continue;
    small[0][j] = seedR / seedN;
    small[1][j] = seedG / seedN;
    small[2][j] = seedB / seedN;
  }

  // Jacobi diffusion: unknown pixels relax to the average of their
  // neighbours, so the wall's gradient and the cast shadow flow inward.
  for (let c = 0; c < 3; c++) {
    let cur = small[c];
    let next = new Float32Array(cur);
    for (let it = 0; it < PLATE_ITERS; it++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const j = y * w + x;
          if (known[j]) continue;
          const l = x > 0 ? cur[j - 1] : cur[j];
          const r = x < w - 1 ? cur[j + 1] : cur[j];
          const u = y > 0 ? cur[j - w] : cur[j];
          const d = y < h - 1 ? cur[j + w] : cur[j];
          next[j] = (l + r + u + d) * 0.25;
        }
      }
      const swap = cur;
      cur = next;
      next = swap;
    }
    small[c] = cur;
  }

  // Upsample bilinearly; keep the real pixels wherever we have them so the
  // wall's own grain and the shadow stay crisp outside the holes.
  for (let y = 0; y < H; y++) {
    const fy = Math.min(h - 1.001, y / PLATE_SCALE);
    const y0 = fy | 0;
    const ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 3;
      if (isBackground[i]) {
        plate[o] = rgb[o];
        plate[o + 1] = rgb[o + 1];
        plate[o + 2] = rgb[o + 2];
        continue;
      }
      const fx = Math.min(w - 1.001, x / PLATE_SCALE);
      const x0 = fx | 0;
      const tx = fx - x0;
      for (let c = 0; c < 3; c++) {
        const s = small[c];
        const a = s[y0 * w + x0] * (1 - tx) + s[y0 * w + x0 + 1] * tx;
        const b = s[(y0 + 1) * w + x0] * (1 - tx) + s[(y0 + 1) * w + x0 + 1] * tx;
        plate[o + c] = a * (1 - ty) + b * ty;
      }
    }
  }
}

/* ------------------------------------------------------------- encode --- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function writePng(dest, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // truecolour with alpha
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y += 1) {
    Buffer.from(rgba.buffer, rgba.byteOffset).copy(
      raw,
      y * (W * 4 + 1) + 1,
      y * W * 4,
      (y + 1) * W * 4
    );
  }
  writeFileSync(
    dest,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ])
  );
  console.log(`[make-tv-layers] wrote ${W}x${H} ${path.relative(root, dest)}`);
}

// Masks: four layers per file, one per channel. Alpha carries a layer too, so
// it must not be premultiplied away — every channel is independent data here.
for (const [file, base] of [["final_tv_alpha_a.png", 0], ["final_tv_alpha_b.png", 4]]) {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 4; c++) buf[i * 4 + c] = masks[base + c][i];
  }
  writePng(out(file), buf);
}

{
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = plate[i * 3];
    buf[i * 4 + 1] = plate[i * 3 + 1];
    buf[i * 4 + 2] = plate[i * 3 + 2];
    buf[i * 4 + 3] = 255;
  }
  writePng(out("final_tv_plate.png"), buf);
}

{
  let luma = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 3;
    luma[i] = 0.299 * rgb[o] + 0.587 * rgb[o + 1] + 0.114 * rgb[o + 2];
  }
  for (let i = 0; i < 2; i++) luma = boxBlur(luma, GLINT_BLUR);
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = luma[i];
    buf[i * 4 + 3] = 255;
  }
  writePng(out("final_tv_glint.png"), buf);
}

const covered = owner.reduce((n, o) => n + (o >= 0 ? 1 : 0), 0);
console.log(
  `[make-tv-layers] ${TVS.length} layers, ${((covered / (W * H)) * 100).toFixed(1)}% of the frame is TV`
);
