/*
 * Moment messages — the birthday / big win / welcome / announcement cards.
 *
 * A moment's `content` is JSON, not prose: `{"type":"birthday","name":"Amara"}`.
 * That means anywhere a message is shown as plain text (the sidebar, the room
 * cards, pins, reply excerpts) has to go through here first, or the raw JSON
 * lands on screen. The card copy and the one-line preview copy live together
 * so they can't drift apart.
 */

/** A 'moment' message's payload — `{"type":"birthday","name":"Amara"}`. */
export function momentPayload(content: string): { type: string; name: string } | null {
  try {
    const p = JSON.parse(content);
    if (p && typeof p === "object" && typeof p.name === "string") {
      return { type: typeof p.type === "string" ? p.type : "birthday", name: p.name };
    }
  } catch {
    /* not a moment we understand */
  }
  return null;
}

/** The announcement card kinds — each renders its own moment card. */
export const MOMENT_TYPES: {
  key: string;
  chip: string;
  icon: string;
  placeholder: string;
  title: (v: string) => string;
  /** The same moment squeezed into a preview line — keep it short. */
  preview: (v: string) => string;
  cheer: string;
  confetti: boolean;
  grad: string;
}[] = [
  {
    key: "birthday",
    chip: "birthday",
    icon: "🎂",
    placeholder: "whose birthday is it?",
    title: (n) => `it's ${n}'s birthday 🎂`,
    preview: (n) => `🎂 ${n}'s birthday`,
    cheer: "🎉 throw confetti",
    confetti: true,
    grad: "linear-gradient(135deg, #fff7e0, #ffeef6)",
  },
  {
    key: "win",
    chip: "big win",
    icon: "🎉",
    placeholder: "what are we celebrating?",
    title: (t) => `${t} 🎉`,
    preview: (t) => `🎉 ${t}`,
    cheer: "🎉 throw confetti",
    confetti: true,
    grad: "linear-gradient(135deg, #e3f4ff, #ffeef6)",
  },
  {
    key: "welcome",
    chip: "welcome",
    icon: "💙",
    placeholder: "who just joined us?",
    title: (n) => `welcome to the room, ${n} 💙`,
    preview: (n) => `💙 welcome, ${n}`,
    cheer: "👋 say hi",
    confetti: true,
    grad: "linear-gradient(135deg, #e8f6f1, #e3f4ff)",
  },
  {
    key: "announcement",
    chip: "announcement",
    icon: "📣",
    placeholder: "what does the room need to know?",
    title: (t) => `📣 ${t}`,
    preview: (t) => `📣 ${t}`,
    cheer: "💙 noted",
    confetti: false,
    grad: "linear-gradient(135deg, #fff7e0, #e3f4ff)",
  },
];

/** The card kind for a moment's payload; unknown types fall back to birthday. */
export function momentTypeOf(type: string | undefined) {
  return MOMENT_TYPES.find((t) => t.key === type) ?? MOMENT_TYPES[0];
}
