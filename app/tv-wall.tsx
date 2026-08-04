"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import {
  SCENES,
  sceneKeyFor,
  SCENE,
  PARALLAX_ENABLED,
  hrefFor,
  MAX_TILT_X_DEG,
  MAX_TILT_Y_DEG,
  PARALLAX_STRENGTH,
  FOCUS_DEPTH,
  EASE,
  SCREEN_VIGNETTE,
  SCREEN_GLINT,
} from "@/lib/tv-wall-config.mjs";
import { drawClip, drawStatic, type ChannelId } from "@/app/tv-clips";

/*
 * The home page: the photographic TV-wall artwork as a parallax scene.
 *
 * LAYERS, NOT A DEPTH WARP. The obvious way to do this is to displace every
 * pixel of one image by a depth map, but a silhouette is then a cliff in the
 * displacement field and the pixels along it get stretched across the gap —
 * TV corners visibly gliding off their sets. Here each TV is a rigid sprite
 * (masks from scripts/make-tv-layers.mjs) that translates as a unit, so a
 * detached corner is geometrically impossible, and the sliver a shift opens
 * shows the inpainted plate: real wall, not smeared TV. Only the wall and
 * floor are still warped — smooth gradients with no edges to tear.
 *
 * The screens are live: each glass area is replaced by a canvas texture
 * painted every frame from app/tv-clips.ts (or animated static, or a video
 * file) — see the `screen` config in lib/tv-wall-config.mjs. Screens are
 * composited inside their own layer, so they ride along with their set.
 *
 * Open with ?debug=1 to see hit zones (green) and screen glass (pink).
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * The per-layer composite is generated rather than written out, because GLSL
 * can't index sampler arrays dynamically and the draw order has to be
 * back-to-front by depth — both are known at build time, so they're baked in.
 */
function buildFragmentShader(order: number[], parallax: boolean) {
  const layer = (i: number) => {
    const channel = "rgba"[i % 4];
    const alphaTex = i < 4 ? "uAlphaA" : "uAlphaB";
    return /* glsl */ `
    {
      vec2 src = clamp(uv + uShift * (uLayerDepth[${i}] - uFocus), 0.0005, 0.9995);
      float a = texture2D(${alphaTex}, src).${channel};
      if (a > 0.002) {
        vec3 c = texture2D(uColor, src).rgb;
        c = withScreen(${i}, src, c);
        color = mix(color, c, a);
      }
    }`;
  };

  return /* glsl */ `
  precision highp float;

  uniform sampler2D uColor;
  uniform sampler2D uGlint;
${parallax ? `
  uniform sampler2D uPlate;
  uniform sampler2D uAlphaA;
  uniform sampler2D uAlphaB;
  uniform vec2  uShift;          // tan(tilt) * strength, aspect-corrected
  uniform float uFocus;
  uniform float uOverscan;
  uniform float uLayerDepth[8];  // 0-1, larger = nearer
` : ""}

${parallax ? `
  // Wall/floor depth model, so the plate can be warped analytically.
  uniform float uWallTop;
  uniform float uWallSeam;
  uniform float uFloorSeamY;
  uniform float uFloorKneeY;
  uniform float uFloorKnee;
  uniform float uFloorNear;
` : ""}

  uniform mat3  uScreenInv[8];
  uniform vec4  uScreenShape[8]; // x radius, y bulge, z enabled, w mix
  uniform sampler2D uScreen0;
  uniform sampler2D uScreen1;
  uniform sampler2D uScreen2;
  uniform sampler2D uScreen3;
  uniform sampler2D uScreen4;
  uniform sampler2D uScreen5;
  uniform sampler2D uScreen6;
  uniform sampler2D uScreen7;

  uniform float uVignette;
  uniform float uGlintAmount;
  uniform vec4  uZones[8];
  uniform float uDebug;
  uniform float uHover;

  varying vec2 vUv;

  vec3 screenColor(int i, vec2 s) {
    if (i == 0) return texture2D(uScreen0, s).rgb;
    if (i == 1) return texture2D(uScreen1, s).rgb;
    if (i == 2) return texture2D(uScreen2, s).rgb;
    if (i == 3) return texture2D(uScreen3, s).rgb;
    if (i == 4) return texture2D(uScreen4, s).rgb;
    if (i == 5) return texture2D(uScreen5, s).rgb;
    if (i == 6) return texture2D(uScreen6, s).rgb;
    return texture2D(uScreen7, s).rgb;
  }

  mat3 screenInv(int i) {
    for (int k = 0; k < 8; k++) if (k == i) return uScreenInv[k];
    return uScreenInv[0];
  }
  vec4 screenShape(int i) {
    for (int k = 0; k < 8; k++) if (k == i) return uScreenShape[k];
    return uScreenShape[0];
  }

  /* Paints the live picture into one layer's glass, in that layer's own
     (already shifted) texture space, so it travels with the set. */
  vec3 withScreen(int i, vec2 src, vec3 c) {
    vec4 shape = screenShape(i);
    if (shape.z < 0.5) return c;

    vec3 hp = screenInv(i) * vec3(src, 1.0);
    vec2 s = hp.xy / hp.z;
    if (s.x < -0.03 || s.x > 1.03 || s.y < -0.03 || s.y > 1.03) return c;

    // Rounded-rectangle mask; radius 0.5 makes the porthole a circle.
    vec2 q = abs(s - 0.5) - (0.5 - shape.x);
    float dist = length(max(q, 0.0)) - shape.x;
    float mask = 1.0 - smoothstep(-0.02, 0.0, dist);

    if (uDebug > 0.5 && abs(dist) < 0.012) return mix(c, vec3(0.95, 0.45, 0.75), 0.85);
    if (mask <= 0.0) return c;

    // CRT glass: sample toward the centre near the rim so the picture curves.
    vec2 ctr = s - 0.5;
    vec2 sb = 0.5 + ctr * (1.0 - shape.y * dot(ctr, ctr));
    vec3 vid = screenColor(i, vec2(sb.x, 1.0 - sb.y));

    // A hint of tube fall-off, plus a little of the photo's own reflections.
    // Both stay subtle: the glass in the artwork is already shaded, so laying
    // a strong gradient over it just reads as a dark ring painted on.
    float vignette = 1.0 - uVignette * smoothstep(0.35, 0.78, length(ctr));
    float glint = smoothstep(0.62, 0.88, texture2D(uGlint, src).r);
    vid = vid * vignette + glint * uGlintAmount;

    return mix(c, vid, mask * shape.w);
  }

${parallax ? `
  /* Depth of the wall/floor at a height, measured from the image top. */
  float bgDepth(float yTop) {
    if (yTop < uFloorSeamY) return mix(uWallTop, uWallSeam, yTop / uFloorSeamY);
    float t = (yTop - uFloorSeamY) / (1.0 - uFloorSeamY);
    float knee = (uFloorKneeY - uFloorSeamY) / (1.0 - uFloorSeamY);
    if (t < knee) {
      // Perspective squeezes the wall-to-TVs stretch of floor into few rows.
      float s = t / knee;
      return mix(uWallSeam, uFloorKnee, s * s * (3.0 - 2.0 * s));
    }
    return mix(uFloorKnee, uFloorNear, (t - knee) / (1.0 - knee));
  }
` : ""}

  void main() {
${parallax ? `
    // Zoom in slightly so shifted reads never leave the texture — this is
    // what keeps the edges seamless against the viewport at full tilt.
    vec2 uv = 0.5 + (vUv - 0.5) * uOverscan;

    // The plate has no silhouettes, so warping it can't tear anything. Two
    // passes because the depth it samples is itself a function of height.
    vec2 plateUv = uv;
    for (int i = 0; i < 2; i++) {
      plateUv = uv + uShift * (bgDepth(1.0 - plateUv.y) - uFocus);
    }
    vec3 color = texture2D(uPlate, clamp(plateUv, 0.0005, 0.9995)).rgb;

    // Sets over the top, back to front — each rigid, each with its screen.
    ${order.map(layer).join("\n")}
` : `
    // Parallax off: the artwork straight through, screens painted onto it.
    vec2 uv = vUv;
    vec3 color = texture2D(uColor, uv).rgb;
    ${order.map((i) => `color = withScreen(${i}, uv, color);`).join("\n    ")}
`}

    if (uDebug > 0.5) {
      for (int i = 0; i < 8; i++) {
        vec4 z = uZones[i];
        if (uv.x < z.x || uv.x > z.z || uv.y < z.y || uv.y > z.w) continue;
        vec2 edge = min(uv - z.xy, z.zw - uv);
        float border = step(min(edge.x, edge.y), 0.0018);
        vec3 tint = float(i) == uHover ? vec3(0.65, 0.55, 0.98) : vec3(0.35, 0.9, 0.6);
        color = mix(color, tint, max(border, 0.1));
      }
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
}

/*
 * Projective map for one screen: the unit square onto the measured glass quad
 * (Heckbert's formulation), inverted so the shader can go texture-uv ->
 * screen-local. Corners arrive as [TL, TR, BR, BL] in texture uv space.
 */
function quadHomographyInverse(quad: [number, number][]) {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1[0] - p2[0];
  const dy1 = p1[1] - p2[1];
  const dx2 = p3[0] - p2[0];
  const dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return new THREE.Matrix3()
    .set(
      p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0],
      p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1],
      g, h, 1
    )
    .invert();
}

export default function TvWall({ signedIn }: { signedIn: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  /*
   * Which composition to show. Portrait viewports get the stacked artwork,
   * which is a different image with its own sets — so this drives a full
   * teardown and rebuild rather than a uniform tweak. Chosen after mount so
   * the server and the first client paint agree.
   */
  const [sceneKey, setSceneKey] = useState<"wide" | "tall" | null>(null);
  useEffect(() => {
    const pick = () => setSceneKey(sceneKeyFor(window.innerWidth, window.innerHeight));
    pick();
    window.addEventListener("resize", pick);
    window.addEventListener("orientationchange", pick);
    return () => {
      window.removeEventListener("resize", pick);
      window.removeEventListener("orientationchange", pick);
    };
  }, []);

  const scene = sceneKey ? SCENES[sceneKey] : null;
  const tvs: (typeof SCENES)["wide"]["tvs"] = scene ? scene.tvs : [];

  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !scene) return;

    const art = scene.art;
    const sceneTvs = scene.tvs;
    // The rigid-layer pipeline only has generated masks for the wide artwork.
    const parallax = PARALLAX_ENABLED && sceneKey === "wide";

    let disposed = false;
    const cleanups: (() => void)[] = [];

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      // A silent black page is the worst failure mode — say why.
      console.error("[tv-wall] WebGL unavailable:", error);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1e1e23);
    host.appendChild(renderer.domElement);
    cleanups.push(() => {
      renderer.dispose();
      // dispose() leaves the GL context alive until GC; under hot-reload the
      // remounts pile contexts up until the browser refuses a new one.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    });

    const loader = new THREE.TextureLoader();
    const load = (src: string) =>
      new Promise<THREE.Texture>((resolve, reject) =>
        loader.load(src, resolve, undefined, () => reject(new Error(src)))
      );

    // With the parallax off the plate and masks are never sampled, so they
    // are not fetched either — that is several MB the page skips. Only the
    // wide artwork has them generated at all.
    const layers = art as { plate?: string; alphaA?: string; alphaB?: string };
    const sources = [art.color, art.glint];
    if (parallax && layers.plate && layers.alphaA && layers.alphaB) {
      sources.push(layers.plate, layers.alphaA, layers.alphaB);
    }

    Promise.all(sources.map(load)).then(
      ([colorMap, glintMap, plateMap, alphaA, alphaB]) => {
        if (disposed) return;

        const loaded = [colorMap, glintMap, plateMap, alphaA, alphaB].filter(
          Boolean
        ) as THREE.Texture[];
        for (const t of loaded) {
          // Full-resolution sampling (no mip level) keeps the artwork crisp;
          // bilinear on the masks antialiases the moving silhouettes.
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.generateMipmaps = false;
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        }
        if (alphaA && alphaB) {
          // Four independent layers ride in each RGBA texture, so the alpha
          // channel is data — three.js must not premultiply it away.
          alphaA.premultiplyAlpha = false;
          alphaB.premultiplyAlpha = false;
        }

        const img = colorMap.image as { width: number; height: number };
        const imageAspect = img.width / img.height;

        const threeScene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const maxTilt = new THREE.Vector2(
          THREE.MathUtils.degToRad(MAX_TILT_X_DEG),
          THREE.MathUtils.degToRad(MAX_TILT_Y_DEG)
        );

        // The shader's arrays are a fixed 8 slots; a shorter scene pads them
        // with disabled entries rather than needing a second shader shape.
        const SLOTS = 8;
        const depths: number[] = Array.from(
          { length: SLOTS },
          (_, i) => (sceneTvs[i]?.depth ?? 0) / 255
        );

        let overscan = 1;
        if (parallax) {
          // Widest excursion anything can take, so the overscan zoom keeps
          // every read inside the texture at full tilt.
          const spread = [
            ...sceneTvs.map((t: { depth: number }) => t.depth / 255),
            SCENE.wallTop / 255,
            SCENE.floorNear / 255,
          ].map((d) => Math.abs(d - FOCUS_DEPTH));
          const maxDeviation = Math.max(...spread);
          const marginX = Math.tan(maxTilt.x) * Math.abs(PARALLAX_STRENGTH) * maxDeviation;
          const marginY =
            Math.tan(maxTilt.y) * Math.abs(PARALLAX_STRENGTH) * imageAspect * maxDeviation;
          overscan = 1 - 2 * Math.max(marginX, marginY);
        }

        // Painter's algorithm: farthest set first.
        const order = sceneTvs
          .map((_: unknown, i: number) => i)
          .sort((a: number, b: number) => depths[a] - depths[b]);

        // Degenerate rects for the unused slots so they can never be hit.
        const zonesUv = Array.from({ length: SLOTS }, (_, i) => {
          const z = sceneTvs[i]?.zone;
          return z
            ? new THREE.Vector4(z.x, 1 - (z.y + z.h), z.x + z.w, 1 - z.y)
            : new THREE.Vector4(2, 2, 2, 2);
        });

        // ---- live screen textures --------------------------------------
        const screenPainters: (((t: number) => void) | null)[] = [];
        const screenTextures: THREE.Texture[] = [];
        const screenInv: THREE.Matrix3[] = [];
        const screenShape: THREE.Vector4[] = [];

        const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
        blank.needsUpdate = true;

        for (let i = 0; i < SLOTS; i++) {
          const tv = sceneTvs[i];
          if (!tv) {
            screenInv.push(new THREE.Matrix3());
            screenShape.push(new THREE.Vector4(0, 0, 0, 0));
            screenTextures.push(blank);
            screenPainters.push(null);
            continue;
          }
          const sc = tv.screen;
          const quadUv = sc.quad.map((p: number[]): [number, number] => [p[0], 1 - p[1]]);
          screenInv.push(quadHomographyInverse(quadUv));

          const source = sc.source as
            | { type: "channel"; id: ChannelId }
            | { type: "static" }
            | { type: "video"; src: string };

          if (source.type === "video") {
            // Plays muted/looped; until it has frames the artwork's own baked
            // screen stays visible (mix weight 0).
            const video = document.createElement("video");
            video.src = source.src;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";
            video.play().catch(() => {});
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.minFilter = THREE.LinearFilter;
            screenTextures.push(videoTexture);
            screenPainters.push(null);
            const markReady = () => screenShape[i].setW(1);
            video.addEventListener("loadeddata", markReady);
            cleanups.push(() => {
              video.removeEventListener("loadeddata", markReady);
              video.pause();
              video.removeAttribute("src");
            });
          } else {
            // Backing canvas at the glass's real proportions; small and
            // nearest-filtered on purpose — chunky pixels read as CRT.
            const pw = (sc.quad[1][0] - sc.quad[0][0]) * art.width;
            const ph = (sc.quad[3][1] - sc.quad[0][1]) * art.height;
            const cw = 96;
            const ch = Math.max(48, Math.round((cw * ph) / pw));
            const canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext("2d")!;

            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            screenTextures.push(texture);

            if (source.type === "channel") {
              screenPainters.push((t) => {
                drawClip(ctx, cw, ch, source.id, t);
                texture.needsUpdate = true;
              });
            } else {
              screenPainters.push(() => {
                drawStatic(ctx, cw, ch);
                texture.needsUpdate = true;
              });
            }
          }

          screenShape.push(
            new THREE.Vector4(sc.radius, sc.bulge, 1, source.type === "video" ? 0 : 1)
          );
        }

        const uniforms: Record<string, THREE.IUniform> = {
          uColor: { value: colorMap },
          uGlint: { value: glintMap },
          uScreenInv: { value: screenInv },
          uScreenShape: { value: screenShape },
          uVignette: { value: SCREEN_VIGNETTE },
          uGlintAmount: { value: SCREEN_GLINT },
          uZones: { value: zonesUv },
          uDebug: {
            value: new URLSearchParams(window.location.search).has("debug") ? 1 : 0,
          },
          uHover: { value: -1 },
        };
        if (parallax) {
          Object.assign(uniforms, {
            uPlate: { value: plateMap },
            uAlphaA: { value: alphaA },
            uAlphaB: { value: alphaB },
            uShift: { value: new THREE.Vector2() },
            uFocus: { value: FOCUS_DEPTH },
            uOverscan: { value: overscan },
            uLayerDepth: { value: depths },
            uWallTop: { value: SCENE.wallTop / 255 },
            uWallSeam: { value: SCENE.wallSeam / 255 },
            uFloorSeamY: { value: SCENE.floorSeamY },
            uFloorKneeY: { value: SCENE.floorKneeY },
            uFloorKnee: { value: SCENE.floorKnee / 255 },
            uFloorNear: { value: SCENE.floorNear / 255 },
          });
        }
        screenTextures.forEach((t, i) => {
          uniforms[`uScreen${i}`] = { value: t };
        });

        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader: buildFragmentShader(order, parallax),
          })
        );
        threeScene.add(plane);
        cleanups.push(() => {
          plane.geometry.dispose();
          (plane.material as THREE.ShaderMaterial).dispose();
          [...loaded, ...screenTextures, blank].forEach((t) => t.dispose());
        });

        // Cover the viewport like background-size: cover.
        const resize = () => {
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          const viewAspect = window.innerWidth / window.innerHeight;
          plane.scale.set(
            Math.max(1, imageAspect / viewAspect),
            Math.max(1, viewAspect / imageAspect),
            1
          );
        };
        window.addEventListener("resize", resize);
        cleanups.push(() => window.removeEventListener("resize", resize));
        resize();

        // ---- picking ---------------------------------------------------
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();

        const zoneAt = (uv: THREE.Vector2) => {
          // Mirror the shader's overscan so hits land where pixels render.
          const u = 0.5 + (uv.x - 0.5) * overscan;
          const v = 0.5 + (uv.y - 0.5) * overscan;
          for (let i = 0; i < sceneTvs.length; i++) {
            const z = zonesUv[i];
            if (u >= z.x && u <= z.z && v >= z.y && v <= z.w) return i;
          }
          return -1;
        };

        const pick = (event: { clientX: number; clientY: number }) => {
          ndc.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
          );
          raycaster.setFromCamera(ndc, camera);
          const hit = raycaster.intersectObject(plane)[0];
          return hit?.uv ? zoneAt(hit.uv) : -1;
        };

        // ---- pointer ---------------------------------------------------
        const mouseTarget = new THREE.Vector2();
        const mouse = new THREE.Vector2();
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const onMove = (event: PointerEvent) => {
          if (parallax && !reduceMotion) {
            mouseTarget.set(
              THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1),
              THREE.MathUtils.clamp(-((event.clientY / window.innerHeight) * 2 - 1), -1, 1)
            );
          }
          const hovered = pick(event);
          renderer.domElement.style.cursor = hovered >= 0 ? "pointer" : "";
          uniforms.uHover.value = hovered;
        };
        const onLeave = (event: PointerEvent) => {
          if (!event.relatedTarget) mouseTarget.set(0, 0);
        };
        const onBlur = () => mouseTarget.set(0, 0);
        const onClick = (event: MouseEvent) => {
          const i = pick(event);
          if (i >= 0) router.push(hrefFor(sceneTvs[i], signedInRef.current));
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerout", onLeave);
        window.addEventListener("blur", onBlur);
        renderer.domElement.addEventListener("click", onClick);
        cleanups.push(() => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerout", onLeave);
          window.removeEventListener("blur", onBlur);
          renderer.domElement.removeEventListener("click", onClick);
        });

        // ---- render loop -----------------------------------------------
        const clock = new THREE.Clock();
        let elapsed = 0;
        renderer.setAnimationLoop(() => {
          const dt = Math.min(clock.getDelta(), 0.05);
          elapsed += dt;

          if (parallax) {
            // Frame-rate-independent damping — same feel at any refresh rate.
            mouse.lerp(mouseTarget, 1 - Math.exp(-EASE * dt));
            (uniforms.uShift.value as THREE.Vector2).set(
              Math.tan(mouse.x * maxTilt.x) * PARALLAX_STRENGTH,
              Math.tan(mouse.y * maxTilt.y) * PARALLAX_STRENGTH * imageAspect
            );
          }

          for (const paint of screenPainters) paint?.(elapsed);
          renderer.render(threeScene, camera);
        });
        cleanups.push(() => renderer.setAnimationLoop(null));

        setReady(true);
      },
      (err) => {
        console.error("[tv-wall] failed to load artwork:", err);
      }
    );

    return () => {
      disposed = true;
      setReady(false);
      cleanups.forEach((fn) => fn());
    };
    // Rebuilt whenever the composition changes; auth flows via signedInRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
        background: "#1e1e23",
        opacity: ready ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      {/* Keyboard & screen-reader path: real links, visible only on focus */}
      <nav aria-label="TV wall">
        {tvs.map((tv: { name: string; href: unknown }) => (
          <a
            key={tv.name}
            href={hrefFor(tv, signedIn)}
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 10,
              padding: "10px 16px",
              borderRadius: 10,
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
              transform: "translateY(-300%)",
            }}
            onFocus={(e) => (e.currentTarget.style.transform = "none")}
            onBlur={(e) => (e.currentTarget.style.transform = "translateY(-300%)")}
          >
            {tv.name}
          </a>
        ))}
      </nav>
    </div>
  );
}
