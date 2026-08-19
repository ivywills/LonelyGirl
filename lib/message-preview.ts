/*
 * How a message reads when it isn't in the room: the sidebar's last line, the
 * room cards on /chat, the pinned strip, reply excerpts.
 *
 * Every one of those is a single line of small text, and every one of them
 * used to do its own `kind` switch — so each had different holes. A voice note
 * showed a raw storage URL on the browse cards, and a moment showed its raw
 * JSON everywhere. One switch, used by all of them, is the fix.
 */

import { momentPayload, momentTypeOf } from "@/lib/moments";

export type PreviewMessage = {
  display_name: string;
  content: string;
  kind: string;
};

const CUSTOM_EMOJI = /\{\{emoji:[^|{}]+\|([^{}]+)\}\}/g;

/** `{{emoji:url|party}}` → `:party:`, so a preview never leaks a URL. */
export function stripCustomEmoji(text: string): string {
  return text.replace(CUSTOM_EMOJI, ":$1:");
}

/*
 * Previews are one line of nowrap text, so a message full of newlines would
 * otherwise spend its whole width on whitespace before the first word.
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The message as one line.
 *
 * `verb` picks the phrasing for the two browse-card surfaces, which read as a
 * sentence after the sender's name ("Ivy sent a photo"); everything else puts
 * the name in its own chip and wants the bare noun ("📷 photo").
 */
export function previewText(m: PreviewMessage, { verb = false }: { verb?: boolean } = {}): string {
  if (m.kind === "gif") return verb ? "sent a GIF" : "GIF";
  if (m.kind === "image") return verb ? "sent a photo" : "📷 photo";
  if (m.kind === "voice") return verb ? "sent a voice note" : "🎙️ voice note";
  if (m.kind === "moment") {
    const payload = momentPayload(m.content);
    // A moment we can't parse would print its JSON — say nothing instead.
    if (!payload) return "shared a moment";
    return oneLine(momentTypeOf(payload.type).preview(payload.name));
  }
  return oneLine(stripCustomEmoji(m.content));
}

/**
 * Who to credit for the line, or null when the message speaks for itself —
 * "Michael entered the room" already names its subject.
 */
export function previewSender(m: PreviewMessage): string | null {
  return m.kind === "system" ? null : m.display_name;
}
