/*
 * Compresses the TV-wall artwork for the wire: the page loads the .webp
 * versions (see lib/tv-wall-config.mjs), which are ~10x smaller than the
 * PNGs at no visible cost. The PNGs stay in public/ as the lossless source
 * of truth — scripts/make-tv-layers.mjs reads and regenerates those, so
 * re-run this after re-running that.
 *
 *   node scripts/make-webp.mjs
 *
 * The alpha masks are NOT converted: their RGBA channels are packed data
 * (four layer masks per texture), they're already tiny as PNG, and lossy
 * compression would corrupt them.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = (f) => path.join(root, "public", f);

// [file, quality] — the color artwork is the hero image, so it gets the
// higher quality; the glint map is only ever thresholded on its red channel.
const JOBS = [
  ["final_tv_color.png", 85],
  ["final_tv_mobile_color.png", 85],
  ["final_tv_plate.png", 85],
  ["final_tv_glint.png", 75],
  ["final_tv_mobile_glint.png", 75],
];

for (const [file, quality] of JOBS) {
  const src = pub(file);
  if (!existsSync(src)) {
    console.warn(`skip ${file} (missing)`);
    continue;
  }
  const dst = src.replace(/\.png$/, ".webp");
  await sharp(src).webp({ quality, effort: 6 }).toFile(dst);
  const before = (statSync(src).size / 1024).toFixed(0);
  const after = (statSync(dst).size / 1024).toFixed(0);
  console.log(`${file}: ${before}K -> ${path.basename(dst)}: ${after}K`);
}
