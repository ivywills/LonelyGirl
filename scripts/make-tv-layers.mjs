/*
 * Cuts public/final_tv_color.png into rigid layers for the home page:
 *
 *   final_tv_alpha_a.png — coverage masks for TVs 0-3, one per RGBA channel
 *   final_tv_alpha_b.png — coverage masks for TVs 4-7
 *   final_tv_plate.png   — wall + floor with every TV inpainted away
 *   final_tv_glint.png    — blurred luminance, the photo's glass reflections
 *
 * The page serves .webp versions of the big textures — run
 * scripts/make-webp.mjs after this to refresh them.
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

/** Decode a PNG to flat RGB via a temporary BMP. Returns null if missing. */
function readImage(file) {
  let bmp;
  try {
    const bmpPath = path.join(tmpdir(), `lonelygirl-layers-${process.pid}-${path.basename(file)}.bmp`);
    execFileSync("sips", ["-s", "format", "bmp", file, "--out", bmpPath], { stdio: "ignore" });
    bmp = readFileSync(bmpPath);
    rmSync(bmpPath);
  } catch {
    return null;
  }
  const dataOffset = bmp.readUInt32LE(10);
  const w = bmp.readInt32LE(18);
  const rawH = bmp.readInt32LE(22);
  const h = Math.abs(rawH);
  const topDown = rawH < 0;
  const bpp = bmp.readUInt16LE(28) / 8;
  const stride = Math.ceil((w * bpp) / 4) * 4;
  const px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const row = topDown ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const i = dataOffset + row * stride + x * bpp; // BGR(A)
      const o = (y * w + x) * 3;
      px[o] = bmp[i + 2];
      px[o + 1] = bmp[i + 1];
      px[o + 2] = bmp[i];
    }
  }
  return { rgb: px, W: w, H: h };
}

const source = readImage(COLOR);
if (!source) throw new Error(`Cannot read ${COLOR}`);
const { rgb, W, H } = source;

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
 * Inpaint the wall and floor behind the sets.
 *
 * Isotropic diffusion was tried first and looked wrong: averaging in from
 * every direction at once — including the bright floor — filled each hole
 * with a pale, perfectly smooth blob, which read as frosted glass the moment
 * a set slid off it. Instead every unknown pixel is an inverse-distance blend
 * of the nearest known pixel in each of the four directions. That carries the
 * wall's gradient and its cast shadow straight across the hole, and a little
 * grain goes back on top so the fill isn't glassy-smooth against a wall that
 * has visible texture.
 */
const plate = new Uint8ClampedArray(W * H * 3);
{
  const FAR = 1e9;

  // Sweep once per direction, each pixel inheriting the nearest known colour
  // found so far along that axis.
  function sweep(stepX, stepY) {
    const dist = new Float32Array(W * H);
    const col = new Uint8Array(W * H * 3);
    const xFrom = stepX >= 0 ? 0 : W - 1;
    const xTo = stepX >= 0 ? W : -1;
    const xStep = stepX >= 0 ? 1 : -1;
    const yFrom = stepY >= 0 ? 0 : H - 1;
    const yTo = stepY >= 0 ? H : -1;
    const yStep = stepY >= 0 ? 1 : -1;
    for (let y = yFrom; y !== yTo; y += yStep) {
      for (let x = xFrom; x !== xTo; x += xStep) {
        const i = y * W + x;
        if (isBackground[i]) {
          dist[i] = 0;
          col[i * 3] = rgb[i * 3];
          col[i * 3 + 1] = rgb[i * 3 + 1];
          col[i * 3 + 2] = rgb[i * 3 + 2];
          continue;
        }
        const px = x - stepX;
        const py = y - stepY;
        if (px < 0 || px >= W || py < 0 || py >= H) {
          dist[i] = FAR;
          continue;
        }
        const j = py * W + px;
        dist[i] = dist[j] + 1;
        col[i * 3] = col[j * 3];
        col[i * 3 + 1] = col[j * 3 + 1];
        col[i * 3 + 2] = col[j * 3 + 2];
      }
    }
    return { dist, col };
  }

  const sides = [sweep(1, 0), sweep(-1, 0), sweep(0, 1), sweep(0, -1)];

  // Cheap deterministic hash noise — repeatable builds, no seeded RNG needed.
  const grain = (x, y) => {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h >>> 8) / 8388608 - 1) * PLATE_GRAIN;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 3;
      if (isBackground[i]) {
        plate[o] = rgb[o];
        plate[o + 1] = rgb[o + 1];
        plate[o + 2] = rgb[o + 2];
        continue;
      }
      let wsum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const side of sides) {
        const d = side.dist[i];
        if (d >= FAR) continue;
        // Squared falloff keeps the nearest wall dominant, so the fill hugs
        // the gradient it is continuing rather than flattening toward a mean.
        const w = 1 / ((d + 1) * (d + 1));
        wsum += w;
        r += side.col[o] * w;
        g += side.col[o + 1] * w;
        b += side.col[o + 2] * w;
      }
      const n = grain(x, y);
      if (wsum > 0) {
        plate[o] = r / wsum + n;
        plate[o + 1] = g / wsum + n;
        plate[o + 2] = b / wsum + n;
      } else {
        plate[o] = rgb[o];
        plate[o + 1] = rgb[o + 1];
        plate[o + 2] = rgb[o + 2];
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

function writePng(dest, rgba, w = W, h = H) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // truecolour with alpha
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y += 1) {
    Buffer.from(rgba.buffer, rgba.byteOffset).copy(
      raw,
      y * (w * 4 + 1) + 1,
      y * w * 4,
      (y + 1) * w * 4
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
  console.log(`[make-tv-layers] wrote ${w}x${h} ${path.relative(root, dest)}`);
}

/** Blurred luminance — the artwork's own glass reflections, reused on screens. */
function writeGlint(px, w, h, dest) {
  let luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    luma[i] = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
  }
  for (let i = 0; i < 2; i++) luma = boxBlur(luma, GLINT_BLUR, w, h);
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = luma[i];
    buf[i * 4 + 3] = 255;
  }
  writePng(dest, buf, w, h);
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

writeGlint(rgb, W, H, out("final_tv_glint.png"));

// The portrait artwork needs no layers while the parallax is off — but its
// screens still want the photo's own reflections, so give it a glint map too.
{
  const m = readImage(path.join(root, "public", "final_tv_mobile_color.png"));
  if (m) writeGlint(m.rgb, m.W, m.H, out("final_tv_mobile_glint.png"));
  else console.log("[make-tv-layers] no portrait artwork found, skipped its glint");
}

const covered = owner.reduce((n, o) => n + (o >= 0 ? 1 : 0), 0);
console.log(
  `[make-tv-layers] ${TVS.length} layers, ${((covered / (W * H)) * 100).toFixed(1)}% of the frame is TV`
);
