/*
 * The pastel "waitlist" skin, as values. Same relationship to the app that
 * .wl-sky / .wl-card already have: distinct from the dark theme vars, used only
 * by onboarding, the profile card and the edit form.
 *
 * Dark surfaces keep using the app's existing CSS vars unchanged.
 */
export const T = {
  ink: "#2b2733",
  muted: "#6d6478",
  faint: "#a89e94",
  paper: "#fffdf7",
  inputBg: "#fffefb",
  tan: "#d9cdb6",
  tan2: "#e6dcc9",
  canvas: "#faf7f0",
  butter: "#ffdf8e",
  butterDeep: "#f2c452",
  butterTint: "#fff2cf",
  skyTint: "#e3f1fa",
  skyDeep: "#6fb2d9",
  skyInk: "#2c7ba4",
  skyBadge: "#eaf6fc",
  pinkTint: "#fbe6ef",
  pinkDeep: "#e888b7",
  sageTint: "#eaf3e3",
  sageDeep: "#93b97d",
} as const;

export const SERIF = '"Newsreader", Georgia, serif';

export const CARD_RING =
  "0 0 0 2.5px #ffdf8e, 0 20px 36px -18px rgba(43,39,51,.35)";
export const ONBOARDING_RING =
  "0 0 0 3px #ffdf8e, 0 26px 44px -22px rgba(43,39,51,.42)";

/** Chip styling shared by every category — only the tint/deep pair changes. */
export function chip(selected: boolean, tint: string, deep: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 13px",
    borderRadius: 999,
    fontSize: 13,
    whiteSpace: "nowrap",
    cursor: "pointer",
    color: T.ink,
    background: selected ? deep : tint,
    border: `1.5px solid ${selected ? deep : "transparent"}`,
    fontWeight: selected ? 700 : 500,
    boxShadow: selected ? "0 2px 0 rgba(43,39,51,0.1)" : "none",
  };
}

export const CHIP_COLORS = {
  hobbies: [T.butterTint, T.butterDeep] as const,
  fitness: [T.skyTint, T.skyDeep] as const,
  struggles: [T.pinkTint, T.pinkDeep] as const,
  basics: [T.sageTint, T.sageDeep] as const,
  neighborhood: [T.skyTint, T.skyDeep] as const,
};
