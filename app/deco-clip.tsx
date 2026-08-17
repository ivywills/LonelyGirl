"use client";

import { useEffect, useRef } from "react";

/**
 * A small decorative looping clip in a rounded tile — page accents like the
 * chat bubbles and the scrapbook polaroid. `crop` trims the video's edges
 * visually (0.8 = keep the middle 80% of each side) so the source files
 * don't need re-encoding. Purely ornamental: muted, aria-hidden, and left
 * on its first frame under prefers-reduced-motion.
 */
export default function DecoClip({
  src,
  size = 88,
  crop = 1,
  radius = 20,
}: {
  src: string;
  size?: number;
  crop?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current?.pause();
    }
  }, []);

  const scale = 100 / crop;
  const offset = ((scale - 100) / 2) * -1;

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flex: "none",
        display: "inline-block",
        position: "relative",
        boxShadow: "0 6px 18px var(--lift-soft)",
      }}
    >
      <video
        ref={ref}
        src={src}
        muted
        autoPlay
        loop
        playsInline
        disablePictureInPicture
        style={{
          position: "absolute",
          left: `${offset}%`,
          top: `${offset}%`,
          width: `${scale}%`,
          height: `${scale}%`,
          objectFit: "cover",
        }}
      />
    </span>
  );
}
