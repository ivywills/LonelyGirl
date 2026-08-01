/*
 * Draws build/icon.png — the single 1024px source every packager derives from
 * (electron-builder makes .icns/.ico/.png, @capacitor/assets makes the iOS and
 * Android sets). Written by hand against zlib because the repo has no image
 * dependency and this only ever needs to produce one flat picture: a CRT
 * showing static, which is what the app opens with.
 *
 * Run with: npm run icon
 */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SIZE = 1024;
const SS = 2; // supersample factor — the only anti-aliasing here
const W = SIZE * SS;

const buf = new Float32Array(W * W * 4);

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n) => Math.max(0, Math.min(255, n));
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

// Deterministic, so the icon is byte-identical on every machine that builds it.
let seed = 0x5eed;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

/** Signed distance to a rounded rectangle: negative inside. */
function roundRectSD(px, py, x, y, w, h, r) {
  const cx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const cy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - r;
}

/** Paints a rounded rect, asking `shade(u, v)` for the colour at each pixel. */
function roundRect(x, y, w, h, r, shade) {
  const x0 = Math.max(0, Math.floor(x * SS));
  const y0 = Math.max(0, Math.floor(y * SS));
  const x1 = Math.min(W, Math.ceil((x + w) * SS));
  const y1 = Math.min(W, Math.ceil((y + h) * SS));

  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const u = px / SS;
      const v = py / SS;
      if (roundRectSD(u, v, x, y, w, h, r) > 0) continue;

      const c = shade((u - x) / w, (v - y) / h);
      if (!c) continue;

      const [cr, cg, cb, ca = 1] = c;
      const i = (py * W + px) * 4;
      const a = buf[i + 3];
      // Source-over, kept in straight (non-premultiplied) floats.
      const outA = ca + a * (1 - ca);
      if (outA === 0) continue;
      buf[i] = (cr * ca + buf[i] * a * (1 - ca)) / outA;
      buf[i + 1] = (cg * ca + buf[i + 1] * a * (1 - ca)) / outA;
      buf[i + 2] = (cb * ca + buf[i + 2] * a * (1 - ca)) / outA;
      buf[i + 3] = outA;
    }
  }
}

const gradient = (from, to) => {
  const a = hex(from);
  const b = hex(to);
  return (_u, v) => [mix(a[0], b[0], v), mix(a[1], b[1], v), mix(a[2], b[2], v), 1];
};

const solid = (color, alpha = 1) => {
  const c = hex(color);
  return () => [c[0], c[1], c[2], alpha];
};

// ------------------------------------------------------------------ scene

// Backdrop, in the app's own dark palette.
roundRect(0, 0, 1024, 1024, 232, gradient("#2c2836", "#1a191f"));

// TV body, with a soft highlight along the top bezel.
roundRect(122, 236, 780, 556, 96, (u, v) => {
  const g = gradient("#453e59", "#2a2634")(u, v);
  const gloss = Math.max(0, 1 - v * 3.2) * 26;
  return [g[0] + gloss, g[1] + gloss, g[2] + gloss, 1];
});

// Screen: purple, vignetted at the edges, with a scatter of static.
roundRect(186, 300, 652, 400, 62, (u, v) => {
  const g = gradient("#b39cff", "#7c5cd6")(u, v);
  const vignette = 1 - 0.45 * Math.hypot(u - 0.5, v - 0.5) ** 1.6;
  const speck = random();
  // Sparse bright/dark flecks read as static once the image is scaled down.
  const noise = speck > 0.972 ? 78 : speck < 0.03 ? -58 : (speck - 0.5) * 20;
  return [
    clamp(g[0] * vignette + noise),
    clamp(g[1] * vignette + noise),
    clamp(g[2] * vignette + noise),
    1,
  ];
});

// Scanlines — every fourth row, barely there.
for (let y = 300; y < 700; y += 4) {
  roundRect(186, y, 652, 1.4, 0.7, solid("#1a161f", 0.16));
}

// Control strip under the screen: power light plus two dials.
roundRect(206, 726, 596, 10, 5, solid("#211d2b", 0.55));
roundRect(238, 716, 30, 30, 15, solid("#a78bfa", 0.95));
roundRect(300, 720, 22, 22, 11, solid("#5c5470", 0.9));
roundRect(348, 720, 22, 22, 11, solid("#5c5470", 0.9));

// Legs.
roundRect(258, 786, 92, 46, 20, solid("#332e42"));
roundRect(674, 786, 92, 46, 20, solid("#332e42"));

// Rabbit-ear antennae, drawn as thin rects sheared into a V.
for (const dir of [-1, 1]) {
  for (let t = 0; t < 150; t += 1) {
    const x = 512 + dir * t * 0.78;
    const y = 236 - t * 0.92;
    roundRect(x - 7, y - 7, 14, 14, 7, solid("#6f6688"));
  }
  roundRect(512 + dir * 122 - 17, 236 - 145 - 17, 34, 34, 17, solid("#a78bfa"));
}

// ------------------------------------------------------------------ encode

/** Box-downsample the supersampled buffer to SIZE and flatten onto nothing. */
function resolve() {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < SS; dy += 1) {
        for (let dx = 0; dx < SS; dx += 1) {
          const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
          const pa = buf[i + 3];
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const n = SS * SS;
      const o = (y * SIZE + x) * 4;
      // Un-premultiply so edge pixels keep their colour as alpha falls off.
      out[o] = a > 0 ? clamp(Math.round(r / a)) : 0;
      out[o + 1] = a > 0 ? clamp(Math.round(g / a)) : 0;
      out[o + 2] = a > 0 ? clamp(Math.round(b / a)) : 0;
      out[o + 3] = clamp(Math.round((a / n) * 255));
    }
  }
  return out;
}

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

function encodePng(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // One filter byte (0 = none) in front of each scanline.
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = encodePng(resolve());

/*
 * Three copies of one picture, because the two packagers look in different
 * places: electron-builder reads build/icon.png, and @capacitor/assets reads
 * assets/icon.png for app icons and assets/logo.png for splash screens.
 */
const targets = [
  path.join(process.cwd(), "build", "icon.png"),
  path.join(process.cwd(), "assets", "icon.png"),
  path.join(process.cwd(), "assets", "logo.png"),
];

for (const dest of targets) {
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, png);
}

console.log(`[make-icon] wrote ${SIZE}x${SIZE} icon to:\n  ${targets.join("\n  ")}`);
console.log("[make-icon] run `npm run mobile:assets` to regenerate the iOS/Android sets");
