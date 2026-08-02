/*
 * One description of the TV-wall artwork, shared by:
 *   - app/tv-wall.tsx           (the home page — parallax, screens, links)
 *   - scripts/make-tv-layers.mjs (regenerates the masks, plate and glint map)
 *
 * Plain .mjs so the Node script can import it without a build step.
 *
 * Coordinates are FRACTIONS of the artwork measured from its TOP-LEFT corner,
 * so you can read them straight off any image editor. After editing zones,
 * quads or depths, rerun `npm run layers`. Open the home page with ?debug=1
 * to see zones (green) and screen quads (pink) drawn over the image while you
 * calibrate.
 */

/** The rendered artwork and its generated companions, served from public/. */
export const ART = {
  color: "/final_tv_color.png",
  /** Wall + floor with the TVs inpainted away — what a shifted TV reveals. */
  plate: "/final_tv_plate.png",
  /** Per-TV coverage masks: RGBA channels carry TVs 0-3 and 4-7. */
  alphaA: "/final_tv_alpha_a.png",
  alphaB: "/final_tv_alpha_b.png",
  glint: "/final_tv_glint.png",
  width: 2016,
  height: 1134,
};

/*
 * The eight TVs.
 *
 *   href    where clicking goes — a string, or { out, in } to differ by
 *           auth state (signed out / signed in)
 *   zone    the set's silhouette bounding box { x, y, w, h }. Doubles as the
 *           click target and as what splits touching sets apart when the
 *           layer masks are cut, so it has to be TIGHT: where two sets stack,
 *           their shared edge is the seam between them, and a box that
 *           overruns its neighbour hands away a strip of that neighbour —
 *           which then travels with the wrong TV and tears its corner.
 *           Traced against the artwork; check with /?debug=1 after editing.
 *   depth   0-255 layer for the parallax (white = near); keep near FOCUS_DEPTH
 *           so the TVs stay pinned while the wall and floor drift
 *   screen  the live picture composited onto the glass:
 *     quad     the glass corners [TL, TR, BR, BL]
 *     radius   corner rounding in screen-local units — 0.5 makes a circle
 *     bulge    CRT glass curvature (0 = flat)
 *     source   what plays there — swap freely between:
 *                { type: "channel", id: "b" | "c" | "e" | "g" }  tv-clips.ts painter
 *                { type: "static" }                              animated noise
 *                { type: "video", src: "/clips/mine.mp4" }       any video file
 */
export const TVS = [
  {
    name: "Top Purple Retro TV",
    href: "/chat",
    zone: { x: 0.4247, y: 0.1835, w: 0.1613, h: 0.1955 },
    depth: 158,
    screen: {
      quad: [[0.4498, 0.2169], [0.5281, 0.2169], [0.5276, 0.3597], [0.4503, 0.3597]],
      radius: 0.24,
      bulge: 0.1,
      source: { type: "channel", id: "e" }, // popping speech bubbles
    },
  },
  {
    name: "Upper Mid Dark Wood TV",
    href: "/events",
    zone: { x: 0.4167, y: 0.379, w: 0.175, h: 0.2057 },
    depth: 168,
    screen: {
      quad: [[0.4348, 0.415], [0.5304, 0.415], [0.5304, 0.5652], [0.4348, 0.5652]],
      radius: 0.13,
      bulge: 0.07,
      source: { type: "channel", id: "c" }, // sweeping spotlights + crowd
    },
  },
  {
    name: "Center Large Wood TV",
    href: { out: "/signup", in: "/chat" },
    zone: { x: 0.3917, y: 0.5847, w: 0.2166, h: 0.3289 },
    depth: 190,
    screen: {
      quad: [[0.4163, 0.6388], [0.5429, 0.6388], [0.5429, 0.8241], [0.4163, 0.8241]],
      radius: 0.22,
      bulge: 0.12,
      source: { type: "static" },
    },
  },
  {
    name: "Left Middle Small Purple TV",
    href: { out: "/login", in: "/account" },
    zone: { x: 0.24, y: 0.4938, w: 0.1183, h: 0.1562 },
    depth: 172,
    screen: {
      quad: [[0.2549, 0.5332], [0.3163, 0.5332], [0.3163, 0.6381], [0.2549, 0.6381]],
      radius: 0.18,
      bulge: 0.08,
      source: { type: "static" },
    },
  },
  {
    name: "Bottom Left Turquoise TV",
    href: "/playlists",
    zone: { x: 0.2139, y: 0.65, w: 0.1778, h: 0.2468 },
    depth: 182,
    screen: {
      quad: [[0.2378, 0.6966], [0.3235, 0.6966], [0.3235, 0.862], [0.2378, 0.862]],
      radius: 0.14,
      bulge: 0.08,
      source: { type: "channel", id: "b" }, // spinning vinyl + EQ bars
    },
  },
  {
    name: "Right Middle Small Lavender TV",
    href: { out: "/login", in: "/account" },
    zone: { x: 0.6233, y: 0.5551, w: 0.11, h: 0.1349 },
    depth: 170,
    screen: {
      quad: [[0.6383, 0.5873], [0.6959, 0.5873], [0.6959, 0.6843], [0.6383, 0.6843]],
      radius: 0.18,
      bulge: 0.08,
      source: { type: "static" },
    },
  },
  {
    name: "Bottom Right Turquoise TV",
    href: "/shop",
    zone: { x: 0.6139, y: 0.69, w: 0.1517, h: 0.2068 },
    depth: 182,
    screen: {
      quad: [[0.6358, 0.7376], [0.7133, 0.7376], [0.7133, 0.8751], [0.6358, 0.8751]],
      radius: 0.5, // porthole — a circle
      bulge: 0.1,
      source: { type: "static" },
    },
  },
  {
    name: "Far Right Small Dark Blue TV",
    href: "/",
    zone: { x: 0.7722, y: 0.726, w: 0.1278, h: 0.1708 },
    depth: 175,
    screen: {
      quad: [[0.7913, 0.767], [0.8558, 0.767], [0.8558, 0.8816], [0.7913, 0.8816]],
      radius: 0.2,
      bulge: 0.08,
      source: { type: "static" },
    },
  },
];

/** Resolve a TV's link for the current auth state. */
export function hrefFor(tv, signedIn) {
  return typeof tv.href === "string" ? tv.href : signedIn ? tv.href.in : tv.href.out;
}

/*
 * Scene depth model (0-255, white = near). The floor ramp is perspective-
 * aware: the stretch between the wall seam and the TVs' contact line covers a
 * lot of real distance squeezed into few image rows, then flattens out.
 */
export const SCENE = {
  wallTop: 26,
  wallSeam: 36,
  floorSeamY: 0.868, // where wall meets floor
  floorKneeY: 0.915, // the TVs' contact line…
  floorKnee: 178, //    …and the depth there — grounds their shadows
  floorNear: 220,
};

/*
 * Antennae are too thin and gray for the color segmentation to catch, so the
 * layer script stamps them into their TV's mask by hand — otherwise they'd be
 * treated as wall, get inpainted out of the plate, and the set would slide
 * out from under its own aerial. `tv` is the index in TVS they belong to.
 */
// Widths run generous: any aerial pixel missed here stays behind in the plate
// and shows as a ghost twin once its set moves.
export const STROKES = [
  { x0: 0.508, y0: 0.2, x1: 0.51, y1: 0.172, w: 16, tv: 0 }, // TV1 mast
  { x0: 0.51, y0: 0.18, x1: 0.4715, y1: 0.1, w: 11, tv: 0 }, // TV1 left ear
  { x0: 0.51, y0: 0.18, x1: 0.5375, y1: 0.103, w: 11, tv: 0 }, // TV1 right ear
  { x0: 0.4715, y0: 0.1, x1: 0.4715, y1: 0.1, w: 24, tv: 0 }, // left tip ball
  { x0: 0.5375, y0: 0.103, x1: 0.5375, y1: 0.103, w: 24, tv: 0 }, // right tip ball
  { x0: 0.8765, y0: 0.745, x1: 0.8965, y1: 0.663, w: 12, tv: 7 }, // TV8 rod
];

/* Parallax feel. */
export const MAX_TILT_X_DEG = 30; // hard clamp, left/right
export const MAX_TILT_Y_DEG = 15; // hard clamp, up/down
export const PARALLAX_STRENGTH = 0.048; // depth-layer separation; negative flips
export const FOCUS_DEPTH = 0.68; // depth that stays pinned (the TVs' plane)
export const EASE = 4.0; // lower = heavier, more fluid camera

/*
 * Screen look. The artwork's glass already carries its own shading, so these
 * only need to hint at the tube — turned up they read as a dark ring painted
 * onto every screen rather than as glass.
 */
export const SCREEN_VIGNETTE = 0.16; // corner fall-off on the live picture
export const SCREEN_GLINT = 0.16; // how much of the photo's reflections return
