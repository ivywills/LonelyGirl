"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isNativeMobile } from "@/lib/runtime";
import { previewText } from "@/lib/message-preview";
import { MOMENT_TYPES, momentPayload, momentTypeOf } from "@/lib/moments";
import {
  ImagePicker,
  ROOM_COLORS,
  personTheme,
  roomSurface,
  uploadRoomImage,
  type Room,
} from "@/app/chat/rooms-client";
import { ProfileTrigger } from "@/app/profile-card";

type Msg = {
  id: number;
  room_id: string;
  user_id: string;
  display_name: string;
  content: string;
  kind: "text" | "gif" | "system" | "image" | "voice" | "moment";
  pinned: boolean;
  created_at: string;
  reply_to_id: number | null;
  edited_at: string | null;
  duration_secs: number | null;
};

type Reaction = { user_id: string; emoji: string };

/** The tapback row — small on purpose, the full picker is for composing. */
const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

/** The burst rail: taps float up the chat edge for everyone, nothing stored. */
const BURSTS = ["💙", "😂", "😭", "✨", "🎉"];

const CONFETTI_COLORS = ["#f2c452", "#db2777", "#38b6ff", "#0d9488"];

/** Poll option bar fills + their % label colours, by option index. */
const POLL_FILLS = [
  "linear-gradient(90deg, #dbf1ff, #a8dcff)",
  "#f9dcea",
  "#d2efe9",
  "#f6ead0",
];
const POLL_INKS = ["#0b6fb8", "#a81d5b", "#0b6f66", "#8a6d1a"];

type JoinRequest = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  note: string;
  status: string;
};

type Poll = {
  id: string;
  room_id: string;
  creator_id: string;
  creator_name: string;
  question: string;
  options: string[];
  closes_at: string | null;
  created_at: string;
};

type PollVote = { user_id: string; option_idx: number };

type PresenceInfo = {
  name: string;
  joinedAt: number;
  lastMessageAt: number;
  /** Set while on the couch (voice) — a per-tab id the WebRTC mesh dials. */
  voiceId?: string | null;
  muted?: boolean;
};

const EMOJI_SET: [string, string, string][] = [
  ["😀", "grinning happy", "smileys"],
  ["😁", "beaming grin", "smileys"],
  ["😂", "joy laughing", "smileys"],
  ["🤣", "rofl laughing", "smileys"],
  ["😊", "smile blush", "smileys"],
  ["😍", "heart eyes love", "smileys"],
  ["🥰", "love hearts", "smileys"],
  ["😘", "kiss", "smileys"],
  ["😜", "wink tongue", "smileys"],
  ["🤪", "zany crazy", "smileys"],
  ["🤗", "hug", "smileys"],
  ["🤔", "thinking hmm", "smileys"],
  ["😴", "sleepy zzz", "smileys"],
  ["😎", "cool sunglasses", "smileys"],
  ["🥹", "holding back tears", "smileys"],
  ["🥲", "happy tear", "smileys"],
  ["😭", "crying sob", "smileys"],
  ["😢", "sad tear", "smileys"],
  ["😤", "huff frustrated", "smileys"],
  ["😡", "angry mad", "smileys"],
  ["😱", "scream shocked", "smileys"],
  ["😳", "flushed blush", "smileys"],
  ["🫣", "peek shy", "smileys"],
  ["🤫", "shush secret", "smileys"],
  ["🙄", "eye roll", "smileys"],
  ["😬", "grimace awkward", "smileys"],
  ["💀", "skull dead", "smileys"],
  ["👻", "ghost boo", "smileys"],
  ["🤯", "mind blown", "smileys"],
  ["😇", "angel halo", "smileys"],
  ["😈", "devil smirk", "smileys"],
  ["🤢", "sick nauseous", "smileys"],
  ["🥶", "cold freezing", "smileys"],
  ["🥵", "hot heat", "smileys"],
  ["🤠", "cowboy yeehaw", "smileys"],
  ["🤓", "nerd glasses", "smileys"],
  ["👍", "thumbs up yes", "hands"],
  ["👎", "thumbs down no", "hands"],
  ["👏", "clap applause", "hands"],
  ["🙌", "praise hands", "hands"],
  ["🫶", "heart hands", "hands"],
  ["🙏", "pray please thanks", "hands"],
  ["💪", "strong flex", "hands"],
  ["🤝", "handshake deal", "hands"],
  ["👀", "eyes looking", "hands"],
  ["👋", "wave hello bye", "hands"],
  ["✌️", "peace", "hands"],
  ["🤞", "fingers crossed luck", "hands"],
  ["🤙", "call me shaka", "hands"],
  ["👑", "crown queen king", "hands"],
  ["❤️", "red heart love", "hearts"],
  ["🧡", "orange heart", "hearts"],
  ["💛", "yellow heart", "hearts"],
  ["💚", "green heart", "hearts"],
  ["💙", "blue heart", "hearts"],
  ["💜", "purple heart", "hearts"],
  ["🖤", "black heart", "hearts"],
  ["🤍", "white heart", "hearts"],
  ["💖", "sparkling heart", "hearts"],
  ["💔", "broken heart", "hearts"],
  ["❤️‍🔥", "heart on fire", "hearts"],
  ["💘", "cupid arrow heart", "hearts"],
  ["🔥", "fire lit", "fun"],
  ["✨", "sparkles", "fun"],
  ["🌟", "star glowing", "fun"],
  ["⚡", "zap lightning", "fun"],
  ["🎉", "party popper", "fun"],
  ["🎊", "confetti", "fun"],
  ["🎈", "balloon", "fun"],
  ["🏆", "trophy win", "fun"],
  ["🎮", "game controller", "fun"],
  ["🎧", "headphones music", "fun"],
  ["🎵", "music note", "fun"],
  ["🎬", "movie clapper", "fun"],
  ["📺", "tv television", "fun"],
  ["📚", "books study", "fun"],
  ["🌙", "moon night", "fun"],
  ["☀️", "sun day", "fun"],
  ["🌈", "rainbow", "fun"],
  ["🌸", "blossom flower", "fun"],
  ["🌹", "rose flower", "fun"],
  ["🍕", "pizza", "fun"],
  ["🍔", "burger", "fun"],
  ["🍟", "fries", "fun"],
  ["🍩", "donut", "fun"],
  ["🍪", "cookie", "fun"],
  ["🧋", "boba bubble tea", "fun"],
  ["☕", "coffee", "fun"],
  ["🍿", "popcorn", "fun"],
  ["🐱", "cat kitty", "fun"],
  ["🐶", "dog puppy", "fun"],
  ["🐸", "frog", "fun"],
  ["🦋", "butterfly", "fun"],
  ["🚀", "rocket launch", "fun"],
  ["💯", "hundred points", "fun"],
  ["✅", "check yes done", "fun"],
  ["❌", "x no", "fun"],
  ["💤", "zzz sleep", "fun"],
  ["🫠", "melting", "smileys"],
];

const EMOJI_CATS: [string, string][] = [
  ["smileys", "Smileys"],
  ["hands", "Hands"],
  ["hearts", "Hearts"],
  ["fun", "Fun & things"],
];

const SHORTCODES: [RegExp, string][] = [
  [/(^|\s):-?\)(?=\s|$)/g, "$1🙂"],
  [/(^|\s):-?\((?=\s|$)/g, "$1🙁"],
  [/(^|\s):-?D(?=\s|$)/g, "$1😄"],
  [/(^|\s);-?\)(?=\s|$)/g, "$1😉"],
  [/(^|\s):-?[Pp](?=\s|$)/g, "$1😛"],
  [/(^|\s):-?[Oo](?=\s|$)/g, "$1😮"],
  [/(^|\s):-?\/(?=\s|$)/g, "$1😕"],
  [/(^|\s)<3(?=\s|$)/g, "$1❤️"],
  [/(^|\s)[Xx]D(?=\s|$)/g, "$1😆"],
];

function applyShortcodes(text: string): string {
  return SHORTCODES.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

function msgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

const GIF_RE = /^https?:\/\/\S+\.(gif|webp)(\?\S*)?$/i;
const isGif = (s: string) =>
  GIF_RE.test(s.trim()) || /^https?:\/\/(media\.|.*\b)(giphy|tenor)\.com\/\S+$/i.test(s.trim());

const CUSTOM_EMOJI_RE = /\{\{emoji:([^|{}]+)\|([^{}]+)\}\}/g;

function renderMessageContent(content: string): (string | { url: string; name: string })[] {
  const parts: (string | { url: string; name: string })[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  CUSTOM_EMOJI_RE.lastIndex = 0;
  while ((match = CUSTOM_EMOJI_RE.exec(content))) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    parts.push({ url: match[1], name: match[2] });
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
}

function excerptOf(m: Msg, own: boolean): string {
  const who = own ? "You" : m.display_name;
  return `${who}: ${previewText(m).slice(0, 80)}`;
}

/** What a pin reads as in the strip/list — never a raw storage URL. */
function pinLabel(m: Msg): string {
  return previewText(m);
}

async function uploadCustomEmoji(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Custom emoji must be an image.");
  }
  if (file.size > 1024 * 1024) {
    throw new Error("That image is over 1MB. Try a smaller one.");
  }
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error } = await supabase.storage.from("custom-emojis").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("custom-emojis").getPublicUrl(path).data.publicUrl;
}

/** Deterministic waveform for a voice note — same bars for everyone. */
function voiceBars(seed: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 10; i++) bars.push(6 + ((seed * 31 + i * 7919) % 15));
  return bars;
}

/* --------------------------------------------------------------------------
 * Small presentational pieces
 * ------------------------------------------------------------------------ */

function Avatar({ userId, name, size = 34 }: { userId: string; name: string; size?: number }) {
  const p = personTheme(userId);
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        background: p.av,
        color: p.avInk,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
      }}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function VoiceBubble({ m }: { m: Msg }) {
  const p = personTheme(m.user_id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const bars = useMemo(() => voiceBars(m.id), [m.id]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function toggle() {
    if (!audioRef.current) {
      const a = new Audio(m.content);
      a.ontimeupdate = () => setProg(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => {
        setPlaying(false);
        setProg(0);
      };
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  const dur = m.duration_secs ?? 0;
  const durLabel = `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        style={{
          width: 30,
          height: 30,
          flex: "none",
          padding: 0,
          borderRadius: "50%",
          background: p.avInk,
          color: "#ffffff",
          border: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span className="msr" style={{ fontSize: 16 }} aria-hidden>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, height: 22 }} aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: (i + 0.5) / bars.length <= prog ? p.avInk : p.soft,
            }}
          />
        ))}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{durLabel}</span>
    </span>
  );
}

function PollCard({
  poll,
  votes,
  userId,
  narrow,
  onVote,
}: {
  poll: Poll;
  votes: PollVote[];
  userId: string;
  narrow: boolean;
  onVote: (poll: Poll, idx: number) => void;
}) {
  const total = votes.length;
  const mine = votes.find((v) => v.user_id === userId)?.option_idx ?? null;
  const closed = poll.closes_at != null && new Date(poll.closes_at).getTime() < Date.now();
  const closesLabel = poll.closes_at
    ? closed
      ? "closed"
      : `closes ${new Date(poll.closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "open";

  return (
    <div
      style={{
        // Feature card: stays white in both themes, like the design
        background: "#ffffff",
        borderRadius: narrow ? 16 : 18,
        padding: narrow ? "12px 14px 10px" : "13px 16px 11px",
        width: narrow ? "100%" : 400,
        maxWidth: "100%",
        boxShadow: "0 6px 20px rgba(20,116,180,0.12)",
      }}
    >
      <p className="lg-serif" style={{ margin: 0, fontSize: narrow ? 15.5 : 16.5, fontWeight: 600, color: "#2b2733" }}>
        {poll.question}
      </p>
      <p style={{ margin: "1px 0 9px", fontSize: 11.5, color: "#756e82" }}>
        {poll.creator_name || "someone"} asked · {total} vote{total === 1 ? "" : "s"} · {closesLabel}
      </p>
      {poll.options.map((opt, i) => {
        const count = votes.filter((v) => v.option_idx === i).length;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <button
            key={i}
            type="button"
            onClick={() => !closed && onVote(poll, i)}
            aria-label={`Vote ${opt}: ${pct}%${mine === i ? ", your vote" : ""}`}
            disabled={closed}
            style={{
              display: "block",
              width: "100%",
              padding: 0,
              position: "relative",
              borderRadius: 11,
              background: "#f4effc",
              border: mine === i ? `1.5px solid ${POLL_INKS[i % POLL_INKS.length]}` : "1.5px solid transparent",
              marginBottom: 7,
              overflow: "hidden",
              cursor: closed ? "default" : "pointer",
              textAlign: "left",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: `${pct}%`,
                background: POLL_FILLS[i % POLL_FILLS.length],
                borderRadius: 11,
                transition: "width .35s ease",
              }}
            />
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#2c2635",
              }}
            >
              {opt}
              <span style={{ marginLeft: "auto", color: POLL_INKS[i % POLL_INKS.length] }}>{pct}%</span>
            </span>
          </button>
        );
      })}
      <p style={{ margin: "4px 0 0", fontSize: 11.5, fontWeight: 700, color: "#0b6fb8" }}>
        {closed
          ? "poll closed"
          : mine != null
            ? `you voted ${poll.options[mine]} · tap to change`
            : "tap an option to vote"}
      </p>
    </div>
  );
}

/** One screen-wide confetti volley. Random placement is fine — client only. */
function ConfettiLayer({ bursts }: { bursts: number[] }) {
  if (bursts.length === 0) return null;
  return (
    <div className="lg-confetti" aria-hidden>
      {bursts.map((id) =>
        Array.from({ length: 60 }, (_, i) => {
          const round = i % 3 === 0;
          const size = 4 + (i % 5);
          return (
            <span
              key={`${id}-${i}`}
              style={{
                left: `${Math.random() * 100}%`,
                width: size,
                height: round ? size : size + 4,
                borderRadius: round ? "50%" : 2,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${Math.random() * 0.25}s`,
              }}
            />
          );
        })
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }} aria-hidden>
      {[0, 0.15, 0.3].map((d) => (
        <span
          key={d}
          className="lg-tbounce"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: `tbounce 1.2s ${d}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Uppercase section label used in the room-life panel and sheet. */
function PanelLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 8px",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
 * The room
 * ------------------------------------------------------------------------ */

export default function RoomClient({
  room: initialRoom,
  userId,
  displayName,
  isMember: initiallyMember,
  myRequest: initialRequest,
  initialMessages,
  memberCount = 0,
}: {
  room: Room;
  userId: string;
  displayName: string;
  isMember: boolean;
  myRequest: JoinRequest | null;
  initialMessages: Msg[];
  memberCount?: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [room, setRoom] = useState(initialRoom);
  const [member, setMember] = useState(initiallyMember);
  const [myRequest, setMyRequest] = useState(initialRequest);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [customEmojis, setCustomEmojis] = useState<{ id: string; name: string; image_url: string }[]>([]);
  const [showAddEmoji, setShowAddEmoji] = useState(false);
  const [newEmojiName, setNewEmojiName] = useState("");
  const [emojiUploading, setEmojiUploading] = useState(false);
  const [emojiError, setEmojiError] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [welcomeBanner, setWelcomeBanner] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [pinnedList, setPinnedList] = useState<Msg[]>([]);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState("");
  const [amBanned, setAmBanned] = useState(false);
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({});
  const [reactPickerFor, setReactPickerFor] = useState<number | null>(null);
  const [msgMenuFor, setMsgMenuFor] = useState<number | null>(null);
  const [tappedFor, setTappedFor] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [showJump, setShowJump] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [attachBusy, setAttachBusy] = useState(false);
  // Picked but not yet sent — the confirm card above the composer
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; url: string } | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  // New room-life state
  const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
  const [couchAll, setCouchAll] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Record<string, PollVote[]>>({});
  const [cheers, setCheers] = useState<Record<number, { count: number; mine: boolean }>>({});
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [confetti, setConfetti] = useState<number[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dividerId, setDividerId] = useState<number | null>(null);
  const [dividerCount, setDividerCount] = useState(0);
  const [statusTick, setStatusTick] = useState(0);

  // Poll composer
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState<string[]>(["", ""]);
  const [pollCloseMins, setPollCloseMins] = useState(0);

  // Inline forms — window.prompt() doesn't exist in the Electron shell
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [celebrateName, setCelebrateName] = useState("");
  const [momentType, setMomentType] = useState(MOMENT_TYPES[0].key);
  const [reportFor, setReportFor] = useState<Msg | null>(null);
  const [reportReason, setReportReason] = useState("");

  // Room-life panel width — draggable via the grip, remembered per browser
  const [panelW, setPanelW] = useState(232);
  const [panelDragging, setPanelDragging] = useState(false);
  useEffect(() => {
    const saved = Number(localStorage.getItem("lg-roomlife-w"));
    if (saved >= 200 && saved <= 430) setPanelW(saved);
  }, []);

  function startPanelDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelW;
    let lastW = startW;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setPanelDragging(true);
    const move = (ev: PointerEvent) => {
      lastW = Math.min(430, Math.max(200, startW + (startX - ev.clientX)));
      setPanelW(lastW);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setPanelDragging(false);
      localStorage.setItem("lg-roomlife-w", String(lastW));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  // The couch is a voice channel: a small WebRTC mesh, signalled over the
  // room's realtime channel. Peer ids are per-tab so a girl in two windows
  // doesn't dial herself.
  const [inVoice, setInVoice] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const inVoiceRef = useRef(false);
  const voiceIdRef = useRef(`v-${Math.random().toString(36).slice(2, 10)}`);
  const micStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recCancelledRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set in an effect so server and first client render agree (hydration)
  const [onNative, setOnNative] = useState(false);
  useEffect(() => setOnNative(isNativeMobile()), []);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  // The room-life panel is CSS-gated at ≥1080px; between that and the phone
  // layout the header needs its own way onto the couch (the sheet).
  const [panelHidden, setPanelHidden] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1079px)");
    const sync = () => setPanelHidden(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickRef = useRef(true);
  const lastSendRef = useRef(0);
  const lastTypingRef = useRef(0);
  const lastBurstRef = useRef(0);
  const trackRef = useRef<PresenceInfo>({ name: displayName, joinedAt: 0, lastMessageAt: 0 });
  const cheersFetchedRef = useRef<Set<number>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isCreator = room.creator_id === userId;
  const surface = roomSurface(room.bg_color);
  const ink = surface.ink;
  const sub = surface.sub;
  const acc = surface.acc;

  const firstScrollRef = useRef(true);
  useEffect(() => {
    // Only auto-scroll when the reader is already near the bottom. The first
    // scroll is instant so the room always opens at the latest message.
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: firstScrollRef.current ? "auto" : "smooth",
        block: "nearest",
      });
      firstScrollRef.current = false;
    }
  }, [messages.length]);

  // The unread divider: where you left off last visit, frozen at mount so it
  // doesn't chase you down the page while you catch up.
  useEffect(() => {
    const seen = localStorage.getItem(`lg-seen-${room.id}`);
    if (!seen) return;
    const unseen = initialMessages.filter(
      (m) => m.created_at > seen && m.user_id !== userId && m.kind !== "system"
    );
    if (unseen.length > 0) {
      setDividerId(unseen[0].id);
      setDividerCount(unseen.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!messages.length || !stickRef.current) return;
    localStorage.setItem(`lg-seen-${room.id}`, messages[messages.length - 1].created_at);
  }, [messages, room.id]);

  // Presence statuses ("chatty", "just in") age out — refresh twice a minute
  useEffect(() => {
    const t = setInterval(() => setStatusTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!member) return;
    supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .eq("pinned", true)
      .order("created_at", { ascending: true })
      .limit(20)
      .then(({ data }) => {
        if (data) setPinnedList(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, room.id]);

  useEffect(() => {
    supabase
      .from("custom_emojis")
      .select("id, name, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setCustomEmojis(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    const loadBlocks = () =>
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .then(({ data }) => {
          if (live && data) setBlockedIds(new Set(data.map((b) => b.blocked_id)));
        });
    loadBlocks();
    supabase.rpc("is_admin").then(({ data }) => {
      if (live) setIsAdmin(data === true);
    });
    // RLS lets a user read their own ban row — show a plain message instead
    // of letting sends fail with a policy error.
    supabase
      .from("user_bans")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setAmBanned(Boolean(data));
      });
    // The profile sheet fires this after block/unblock so the list updates live.
    const onBlocksChanged = () => loadBlocks();
    window.addEventListener("lg-blocks-changed", onBlocksChanged);
    return () => {
      live = false;
      window.removeEventListener("lg-blocks-changed", onBlocksChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Auto-dismiss the small confirmation line ("Report sent…")
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Polls + votes for this room
  useEffect(() => {
    if (!member) return;
    supabase
      .from("polls")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(30)
      .then(async ({ data }) => {
        if (!data) return;
        setPolls(data);
        if (data.length) {
          const { data: vs } = await supabase
            .from("poll_votes")
            .select("poll_id, user_id, option_idx")
            .in(
              "poll_id",
              data.map((p: Poll) => p.id)
            );
          if (vs) {
            const grouped: Record<string, PollVote[]> = {};
            for (const v of vs) {
              (grouped[v.poll_id] = grouped[v.poll_id] ?? []).push({
                user_id: v.user_id,
                option_idx: v.option_idx,
              });
            }
            setVotes(grouped);
          }
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, room.id]);

  // Confetti counts for any moment messages on screen
  useEffect(() => {
    if (!member) return;
    const momentIds = messages
      .filter((m) => m.kind === "moment" && !cheersFetchedRef.current.has(m.id))
      .map((m) => m.id);
    if (!momentIds.length) return;
    momentIds.forEach((id) => cheersFetchedRef.current.add(id));
    supabase
      .from("moment_cheers")
      .select("moment_id, user_id")
      .in("moment_id", momentIds)
      .then(({ data }) => {
        if (!data) return;
        setCheers((prev) => {
          const next = { ...prev };
          for (const id of momentIds) next[id] = next[id] ?? { count: 0, mine: false };
          for (const c of data) {
            const cur = next[c.moment_id] ?? { count: 0, mine: false };
            next[c.moment_id] = {
              count: cur.count + 1,
              mine: cur.mine || c.user_id === userId,
            };
          }
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, messages]);

  function addReaction(messageId: number, uid: string, emoji: string) {
    setReactions((prev) => {
      const list = prev[messageId] ?? [];
      if (list.some((r) => r.user_id === uid && r.emoji === emoji)) return prev;
      return { ...prev, [messageId]: [...list, { user_id: uid, emoji }] };
    });
  }

  function removeReaction(messageId: number, uid: string, emoji: string) {
    setReactions((prev) => {
      const list = prev[messageId];
      if (!list) return prev;
      return {
        ...prev,
        [messageId]: list.filter((r) => !(r.user_id === uid && r.emoji === emoji)),
      };
    });
  }

  async function loadReactions(ids: number[]) {
    if (!ids.length) return;
    const { data } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids);
    if (data) {
      for (const r of data) addReaction(r.message_id, r.user_id, r.emoji);
    }
  }

  useEffect(() => {
    if (member) loadReactions(initialMessages.map((m) => m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  // Drop "is typing…" entries whose 3.5s window has lapsed
  useEffect(() => {
    const t = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const live = Object.entries(prev).filter(([, v]) => v.until > now);
        return live.length === Object.keys(prev).length ? prev : Object.fromEntries(live);
      });
    }, 1200);
    return () => clearInterval(t);
  }, []);

  async function addCustomEmoji(file: File) {
    const cleanName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const name = cleanName(newEmojiName) || cleanName(file.name.split(".")[0]);
    if (!name) {
      setEmojiError("Give it a short name first.");
      return;
    }
    setEmojiUploading(true);
    setEmojiError("");
    try {
      const url = await uploadCustomEmoji(supabase, userId, file);
      const { data, error: err } = await supabase
        .from("custom_emojis")
        .insert({ user_id: userId, name, image_url: url })
        .select("id, name, image_url")
        .single();
      if (err) throw new Error(err.message);
      if (data) setCustomEmojis((prev) => [...prev, data]);
      setNewEmojiName("");
      setShowAddEmoji(false);
    } catch (err) {
      setEmojiError(err instanceof Error ? err.message : "Upload failed.");
    }
    setEmojiUploading(false);
  }

  async function deleteCustomEmoji(em: { id: string; name: string }) {
    if (!confirm(`Remove your :${em.name}: emoji?`)) return;
    const { error: err } = await supabase.from("custom_emojis").delete().eq("id", em.id);
    if (err) setEmojiError(err.message);
    else setCustomEmojis((prev) => prev.filter((e) => e.id !== em.id));
  }

  function addBurst(emoji: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setBursts((prev) => {
      if (prev.length >= 12) return prev; // cap concurrent glyphs, drop excess
      return [...prev, { id, emoji, x: Math.floor(Math.random() * 36) }];
    });
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 4400);
  }

  useEffect(() => {
    if (!member) return;
    const channel = supabase
      .channel(`room-${room.id}`, { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload: { new: Msg }) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const next = [...prev, payload.new];
            // Keep memory bounded in very busy rooms
            return next.length > 400 ? next.slice(-400) : next;
          });
          // Feed the jump-to-latest pill when the reader is scrolled up
          if (!stickRef.current && payload.new.user_id !== userId) setNewBelow((n) => n + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload: { new: Msg }) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
          setPinnedList((prev) => {
            if (payload.new.pinned) {
              const merged = prev.some((m) => m.id === payload.new.id)
                ? prev.map((m) => (m.id === payload.new.id ? payload.new : m))
                : [...prev, payload.new];
              return merged.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-20);
            }
            return prev.filter((m) => m.id !== payload.new.id);
          });
        }
      )
      .on(
        // DELETE events can't be filtered by room (only the old PK survives),
        // so listen unfiltered and drop by id — a no-op for other rooms.
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload: { old: { id?: number } }) => {
          const gone = payload.old?.id;
          if (!gone) return;
          setMessages((prev) => prev.filter((m) => m.id !== gone));
          setPinnedList((prev) => prev.filter((m) => m.id !== gone));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload: { new: { message_id: number; user_id: string; emoji: string } }) =>
          addReaction(payload.new.message_id, payload.new.user_id, payload.new.emoji)
      )
      .on(
        // Composite PK, so the old record carries all three columns.
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload: { old: { message_id?: number; user_id?: string; emoji?: string } }) => {
          const { message_id, user_id, emoji } = payload.old;
          if (message_id && user_id && emoji) removeReaction(message_id, user_id, emoji);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "polls", filter: `room_id=eq.${room.id}` },
        (payload: { new: Poll }) => {
          setPolls((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes" },
        (payload: { new: { poll_id: string; user_id: string; option_idx: number } }) => {
          const v = payload.new;
          setVotes((prev) => ({
            ...prev,
            [v.poll_id]: [
              ...(prev[v.poll_id] ?? []).filter((x) => x.user_id !== v.user_id),
              { user_id: v.user_id, option_idx: v.option_idx },
            ],
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "poll_votes" },
        (payload: { new: { poll_id: string; user_id: string; option_idx: number } }) => {
          const v = payload.new;
          setVotes((prev) => ({
            ...prev,
            [v.poll_id]: [
              ...(prev[v.poll_id] ?? []).filter((x) => x.user_id !== v.user_id),
              { user_id: v.user_id, option_idx: v.option_idx },
            ],
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "poll_votes" },
        (payload: { old: { poll_id?: string; user_id?: string } }) => {
          const { poll_id, user_id } = payload.old;
          if (!poll_id || !user_id) return;
          setVotes((prev) => ({
            ...prev,
            [poll_id]: (prev[poll_id] ?? []).filter((x) => x.user_id !== user_id),
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moment_cheers" },
        (payload: { new: { moment_id: number; user_id: string } }) => {
          const c = payload.new;
          // Own cheer is counted optimistically at tap time
          if (c.user_id === userId) return;
          setCheers((prev) => {
            const cur = prev[c.moment_id] ?? { count: 0, mine: false };
            return { ...prev, [c.moment_id]: { ...cur, count: cur.count + 1 } };
          });
        }
      )
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: { uid: string; name: string } }) => {
          if (payload.uid === userId) return;
          setTypers((prev) => ({
            ...prev,
            [payload.uid]: { name: payload.name, until: Date.now() + 3500 },
          }));
        }
      )
      .on(
        "broadcast",
        { event: "burst" },
        ({ payload }: { payload: { emoji: string; uid: string } }) => {
          if (payload.uid === userId) return; // own bursts are added at tap time
          addBurst(payload.emoji);
        }
      )
      .on(
        "broadcast",
        { event: "rtc" },
        async ({
          payload,
        }: {
          payload: {
            from: string;
            to: string;
            sdp?: RTCSessionDescriptionInit;
            candidate?: RTCIceCandidateInit;
          };
        }) => {
          if (payload.to !== voiceIdRef.current || !inVoiceRef.current) return;
          try {
            let pc = peersRef.current.get(payload.from);
            if (payload.sdp) {
              if (payload.sdp.type === "offer") {
                if (!pc) pc = newVoicePeer(payload.from);
                if (pc.signalingState !== "stable") {
                  // Offer glare (both renegotiated at once): the larger id
                  // politely rolls back, the smaller one's offer wins.
                  if (voiceIdRef.current < payload.from) return;
                  await Promise.all([
                    pc.setLocalDescription({ type: "rollback" }),
                    pc.setRemoteDescription(payload.sdp),
                  ]);
                } else {
                  await pc.setRemoteDescription(payload.sdp);
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendRtc(payload.from, { sdp: answer });
              } else if (pc) {
                await pc.setRemoteDescription(payload.sdp);
              }
            } else if (payload.candidate && pc) {
              await pc.addIceCandidate(payload.candidate);
            }
          } catch {
            /* a dropped peer mid-handshake — presence diffing cleans it up */
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceInfo>();
        const next: Record<string, PresenceInfo> = {};
        for (const [uid, metas] of Object.entries(state)) {
          const m0 = metas[metas.length - 1];
          if (m0)
            next[uid] = {
              name: m0.name,
              joinedAt: m0.joinedAt,
              lastMessageAt: m0.lastMessageAt,
              voiceId: m0.voiceId,
              muted: m0.muted,
            };
        }
        setPresence(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          trackRef.current = { name: displayName, joinedAt: Date.now(), lastMessageAt: 0 };
          channel.track(trackRef.current);
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, room.id]);

  useEffect(() => {
    if (!isCreator) return;
    let active = true;
    const load = () =>
      supabase
        .from("join_requests")
        .select("*")
        .eq("room_id", room.id)
        .eq("status", "pending")
        .then(({ data }) => {
          if (active && data) setRequests(data);
        });
    load();
    const channel = supabase
      .channel(`reqs-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "join_requests", filter: `room_id=eq.${room.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, room.id]);

  async function join() {
    setError("");
    const { error: err } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
      display_name: displayName,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setMember(true);
    if (room.welcome_message) setWelcomeBanner(room.welcome_message);
    // Load recent history now that membership grants read access
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (history) {
      setMessages(history.slice().reverse());
      setHasMore(history.length >= 50);
      loadReactions(history.map((m: Msg) => m.id));
    }
    const { data: joinedMsg } = await supabase
      .from("messages")
      .insert({
        room_id: room.id,
        user_id: userId,
        display_name: displayName,
        content: `${displayName} entered the room`,
        kind: "system",
      })
      .select()
      .single();
    if (joinedMsg) setMessages((prev) => (prev.some((m) => m.id === joinedMsg.id) ? prev : [...prev, joinedMsg]));
    router.refresh();
  }

  async function leave() {
    if (!confirm(`Leave "${room.name}"?`)) return;
    const { error: err } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", userId);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { data, error: err } = await supabase
      .from("join_requests")
      .insert({ room_id: room.id, user_id: userId, display_name: displayName, note: note.trim() })
      .select()
      .single();
    if (err) setError(err.message);
    else setMyRequest(data);
  }

  async function decide(req: JoinRequest, approve: boolean) {
    await supabase
      .from("join_requests")
      .update({ status: approve ? "approved" : "denied" })
      .eq("id", req.id);
    if (approve) {
      await supabase.from("room_members").insert({
        room_id: room.id,
        user_id: req.user_id,
        display_name: req.display_name,
      });
      await supabase.from("messages").insert({
        room_id: room.id,
        user_id: userId,
        display_name: displayName,
        content: `${req.display_name} entered the room`,
        kind: "system",
      });
    }
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  }

  async function loadEarlier() {
    if (!messages.length) return;
    const oldest = messages[0].created_at;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setMessages((prev) => [...data.slice().reverse(), ...prev]);
    setHasMore(data.length >= 50);
    loadReactions(data.map((m: Msg) => m.id));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function bumpMyPresence() {
    if (!channelRef.current) return;
    trackRef.current = { ...trackRef.current, lastMessageAt: Date.now() };
    channelRef.current.track(trackRef.current);
  }

  /* ----------------------------------------------------------------------
   * Couch voice channel (WebRTC mesh over the room's realtime channel)
   * -------------------------------------------------------------------- */

  function sendRtc(to: string, data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
    channelRef.current?.send({
      type: "broadcast",
      event: "rtc",
      payload: { from: voiceIdRef.current, to, ...data },
    });
  }

  /** One connection per remote couch member. Reads refs only, so the realtime
   *  handler can call the closure from any render safely. */
  function newVoicePeer(remoteId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const mic = micStreamRef.current;
    if (mic) mic.getTracks().forEach((t) => pc.addTrack(t, mic));
    else pc.addTransceiver("audio", { direction: "recvonly" }); // listen-only join
    pc.onicecandidate = (e) => {
      if (e.candidate) sendRtc(remoteId, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      let a = peerAudioRef.current.get(remoteId);
      if (!a) {
        a = new Audio();
        a.autoplay = true;
        peerAudioRef.current.set(remoteId, a);
      }
      a.srcObject = e.streams[0];
      a.play().catch(() => {
        /* autoplay policies — the join click usually satisfies them */
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== "connected") return;
      // From here on, adding a track (mic granted mid-call) renegotiates.
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendRtc(remoteId, { sdp: offer });
        } catch {
          /* peer going away */
        }
      };
      // Mic may have landed while the first handshake was in flight
      const mic = micStreamRef.current;
      if (mic) {
        const have = new Set(pc.getSenders().map((s) => s.track));
        mic.getTracks().forEach((t) => {
          if (!have.has(t)) pc.addTrack(t, mic);
        });
      }
    };
    peersRef.current.set(remoteId, pc);
    return pc;
  }

  function dropVoicePeer(remoteId: string) {
    peersRef.current.get(remoteId)?.close();
    peersRef.current.delete(remoteId);
    const a = peerAudioRef.current.get(remoteId);
    if (a) {
      a.pause();
      a.srcObject = null;
      peerAudioRef.current.delete(remoteId);
    }
  }

  async function joinVoice() {
    if (inVoiceRef.current) return;
    // Join instantly, listen-only — the permission prompt must never make
    // the couch feel dead.
    inVoiceRef.current = true;
    setInVoice(true);
    setMicMuted(true);
    trackRef.current = { ...trackRef.current, voiceId: voiceIdRef.current, muted: true };
    channelRef.current?.track(trackRef.current);
    // …then bring the mic in whenever permission lands.
    acquireMic();
  }

  /** Ask for the mic and wire it into every live connection. Retryable —
   *  the 🎧 button calls this again after a denied prompt. */
  async function acquireMic() {
    if (micStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!inVoiceRef.current) {
        // Hung up while the prompt was still open
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      setMicMuted(false);
      for (const [, pc] of peersRef.current) {
        const have = new Set(pc.getSenders().map((s) => s.track));
        stream.getTracks().forEach((t) => {
          if (!have.has(t)) pc.addTrack(t, stream); // renegotiates if connected
        });
      }
      trackRef.current = { ...trackRef.current, muted: false };
      channelRef.current?.track(trackRef.current);
    } catch {
      setNotice("Mic blocked. Allow the microphone for this site, then tap 🎧 to retry.");
    }
  }

  function leaveVoice() {
    inVoiceRef.current = false;
    setInVoice(false);
    setMicMuted(false);
    for (const id of [...peersRef.current.keys()]) dropVoicePeer(id);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    trackRef.current = { ...trackRef.current, voiceId: null, muted: false };
    channelRef.current?.track(trackRef.current);
  }

  function toggleMute() {
    if (!micStreamRef.current) return; // listen-only: nothing to unmute
    const next = !micMuted;
    setMicMuted(next);
    micStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    trackRef.current = { ...trackRef.current, muted: next };
    channelRef.current?.track(trackRef.current);
  }

  // Dial couch members as they appear, hang up on the ones who leave. The
  // lexicographically smaller voiceId makes the offer, so a pair never
  // offers to each other simultaneously.
  useEffect(() => {
    if (!inVoice) return;
    const remoteIds = Object.values(presence)
      .map((p) => p.voiceId)
      .filter((id): id is string => Boolean(id) && id !== voiceIdRef.current);
    for (const rid of remoteIds) {
      if (peersRef.current.has(rid)) continue;
      if (voiceIdRef.current < rid) {
        const pc = newVoicePeer(rid);
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o).then(() => sendRtc(rid, { sdp: o })))
          .catch(() => dropVoicePeer(rid));
      }
      // Larger id waits for their offer.
    }
    for (const rid of [...peersRef.current.keys()]) {
      if (!remoteIds.includes(rid)) dropVoicePeer(rid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inVoice, presence]);

  // Leaving the room page hangs up properly
  useEffect(() => {
    return () => {
      if (inVoiceRef.current) {
        for (const id of [...peersRef.current.keys()]) {
          peersRef.current.get(id)?.close();
        }
        peersRef.current.clear();
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    if (editingMsg) {
      const edited = applyShortcodes(content);
      const stamp = new Date().toISOString();
      const { error: err } = await supabase
        .from("messages")
        .update({ content: edited, edited_at: stamp })
        .eq("id", editingMsg.id);
      if (err) {
        setError(err.message);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMsg.id ? { ...m, content: edited, edited_at: stamp } : m))
      );
      setEditingMsg(null);
      setInput("");
      setShowEmoji(false);
      return;
    }

    const now = Date.now();
    if (now - lastSendRef.current < 600) return;
    lastSendRef.current = now;
    setInput("");
    setShowEmoji(false);
    const gif = isGif(content);
    const { error: err } = await supabase.from("messages").insert({
      room_id: room.id,
      user_id: userId,
      display_name: displayName,
      content: gif ? content : applyShortcodes(content),
      kind: gif ? "gif" : "text",
      reply_to_id: replyTo?.id ?? null,
    });
    if (err) setError(err.message);
    else {
      setReplyTo(null);
      bumpMyPresence();
    }
  }

  async function sendImage(file: File): Promise<boolean> {
    setAttachBusy(true);
    setError("");
    try {
      const url = await uploadRoomImage(supabase, userId, file);
      const { error: err } = await supabase.from("messages").insert({
        room_id: room.id,
        user_id: userId,
        display_name: displayName,
        content: url,
        kind: "image",
        reply_to_id: replyTo?.id ?? null,
      });
      if (err) throw new Error(err.message);
      setReplyTo(null);
      bumpMyPresence();
      setAttachBusy(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setAttachBusy(false);
      return false;
    }
  }

  /** Photos preview above the composer first — nothing uploads until Send. */
  function pickPhoto(file: File) {
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
  }

  async function confirmSendPhoto() {
    if (!pendingPhoto || attachBusy) return;
    const ok = await sendImage(pendingPhoto.file);
    if (ok) {
      URL.revokeObjectURL(pendingPhoto.url);
      setPendingPhoto(null);
    }
  }

  function cancelPhoto() {
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.url);
    setPendingPhoto(null);
  }

  async function toggleReaction(m: Msg, emoji: string) {
    setReactPickerFor(null);
    const mine = (reactions[m.id] ?? []).some((r) => r.user_id === userId && r.emoji === emoji);
    if (mine) {
      const { error: err } = await supabase
        .from("message_reactions")
        .delete()
        .match({ message_id: m.id, user_id: userId, emoji });
      if (err) setError(err.message);
      else removeReaction(m.id, userId, emoji);
    } else {
      const { error: err } = await supabase
        .from("message_reactions")
        .insert({ message_id: m.id, user_id: userId, emoji });
      if (err) setError(err.message);
      else addReaction(m.id, userId, emoji);
    }
  }

  /** Throttled "I'm typing" broadcast — ephemeral, nothing stored. */
  function pingTyping() {
    if (Date.now() - lastTypingRef.current < 1500) return;
    lastTypingRef.current = Date.now();
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: userId, name: displayName },
    });
  }

  /** Throttled emoji burst — floats up for everyone, never stored. */
  function sendBurst(emoji: string) {
    if (Date.now() - lastBurstRef.current < 1000) return;
    lastBurstRef.current = Date.now();
    addBurst(emoji);
    channelRef.current?.send({
      type: "broadcast",
      event: "burst",
      payload: { emoji, uid: userId },
    });
  }

  async function deleteMessage(m: Msg) {
    if (!confirm("Delete this message?")) return;
    const { error: err } = await supabase.from("messages").delete().eq("id", m.id);
    if (err) {
      setError(err.message);
      return;
    }
    // Realtime echoes the delete too; removing now just makes it instant.
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setPinnedList((prev) => prev.filter((x) => x.id !== m.id));
  }

  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportFor) return;
    const m = reportFor;
    const { error: err } = await supabase.from("reports").insert({
      reporter_id: userId,
      reported_user_id: m.user_id,
      message_id: m.id,
      message_content: m.content,
      room_id: room.id,
      reason: reportReason.trim().slice(0, 500),
    });
    if (err) setError(err.message);
    else setNotice("Report sent. An admin will take a look.");
    setReportFor(null);
    setReportReason("");
  }

  async function togglePin(m: Msg) {
    const { error: err } = await supabase.from("messages").update({ pinned: !m.pinned }).eq("id", m.id);
    if (err) setError(err.message);
  }

  async function votePoll(poll: Poll, idx: number) {
    const prevVote = (votes[poll.id] ?? []).find((v) => v.user_id === userId);
    if (prevVote?.option_idx === idx) return;
    // Optimistic — realtime confirms for everyone else
    setVotes((prev) => ({
      ...prev,
      [poll.id]: [
        ...(prev[poll.id] ?? []).filter((v) => v.user_id !== userId),
        { user_id: userId, option_idx: idx },
      ],
    }));
    const { error: err } = await supabase
      .from("poll_votes")
      .upsert({ poll_id: poll.id, user_id: userId, option_idx: idx });
    if (err) setError(err.message);
  }

  async function createPoll(e: React.FormEvent) {
    e.preventDefault();
    const opts = pollOpts.map((t) => t.trim()).filter(Boolean);
    if (!pollQ.trim() || opts.length < 2) {
      setError("A poll needs a question and at least two options.");
      return;
    }
    const closes_at = pollCloseMins
      ? new Date(Date.now() + pollCloseMins * 60000).toISOString()
      : null;
    const { data, error: err } = await supabase
      .from("polls")
      .insert({
        room_id: room.id,
        creator_id: userId,
        creator_name: displayName,
        question: pollQ.trim(),
        options: opts,
        closes_at,
      })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    if (data) setPolls((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
    setShowPollForm(false);
    setPollQ("");
    setPollOpts(["", ""]);
    setPollCloseMins(0);
  }

  function fireConfetti() {
    const id = Date.now();
    setConfetti((prev) => [...prev, id]);
    setTimeout(() => setConfetti((prev) => prev.filter((x) => x !== id)), 1500);
  }

  async function cheerMoment(m: Msg, withConfetti: boolean) {
    if (withConfetti) fireConfetti();
    const cur = cheers[m.id] ?? { count: 0, mine: false };
    if (cur.mine) return; // the shared count is once per person; confetti is free
    setCheers((prev) => ({ ...prev, [m.id]: { count: cur.count + 1, mine: true } }));
    const { error: err } = await supabase
      .from("moment_cheers")
      .insert({ moment_id: m.id, user_id: userId });
    if (err && !err.message.includes("duplicate")) setError(err.message);
  }

  async function celebrate(e: React.FormEvent) {
    e.preventDefault();
    const name = celebrateName.trim();
    if (!name) return;
    const { error: err } = await supabase.from("messages").insert({
      room_id: room.id,
      user_id: userId,
      display_name: displayName,
      content: JSON.stringify({ type: momentType, name: name.slice(0, 80) }),
      kind: "moment",
    });
    if (err) setError(err.message);
    else {
      setShowCelebrate(false);
      setCelebrateName("");
    }
  }

  function copyInvite() {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/chat/${room.id}`)
      .then(() => setNotice("Invite link copied 💙"))
      .catch(() => setNotice(window.location.origin + "/chat/" + room.id));
  }

  /* Voice notes: hold the mic, release to send. */
  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recChunksRef.current = [];
      recCancelledRef.current = false;
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecording(false);
        setRecSecs(0);
        const secs = Math.round((Date.now() - recStartRef.current) / 1000);
        if (recCancelledRef.current || secs < 1) return;
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAttachBusy(true);
        try {
          const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
          const path = `${userId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("voice-notes").upload(path, blob, {
            contentType: blob.type,
            cacheControl: "3600",
          });
          if (upErr) throw new Error(upErr.message);
          const url = supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;
          const { error: err } = await supabase.from("messages").insert({
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            content: url,
            kind: "voice",
            duration_secs: Math.min(secs, 60),
          });
          if (err) throw new Error(err.message);
          bumpMyPresence();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Voice note failed.");
        }
        setAttachBusy(false);
      };
      recorderRef.current = mr;
      recStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      setRecSecs(0);
      recTimerRef.current = setInterval(() => {
        const s = Math.round((Date.now() - recStartRef.current) / 1000);
        setRecSecs(s);
        if (s >= 60) stopRecording(false); // ~60s max
      }, 500);
    } catch {
      setError("Couldn't reach your microphone.");
    }
  }

  function stopRecording(cancel: boolean) {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recCancelledRef.current = cancel;
    recorderRef.current.stop();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase
      .from("chat_rooms")
      .update({
        name: room.name,
        description: room.description,
        bg_color: room.bg_color,
        image_url: room.image_url,
        tags: room.tags,
        is_private: room.is_private,
        rules: room.rules,
        welcome_message: room.welcome_message,
      })
      .eq("id", room.id);
    if (err) setError(err.message);
    else setShowSettings(false);
  }

  /* ------------------------------------------------------------------------
   * Derived data for rendering
   * ---------------------------------------------------------------------- */

  const pinned = pinnedList.filter((m) => !blockedIds.has(m.user_id));
  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id));

  // Presence roster + couch statuses. `statusTick` keeps the labels honest.
  void statusTick;
  const nowMs = Date.now();
  const couch = Object.entries(presence).map(([uid, p]) => {
    const onCouch = Boolean(p.voiceId);
    const status = onCouch
      ? p.muted
        ? "🔇 muted"
        : "🎙️ live"
      : p.lastMessageAt && nowMs - p.lastMessageAt < 5 * 60 * 1000
        ? "chatty"
        : p.joinedAt && nowMs - p.joinedAt < 2 * 60 * 1000
          ? "just in"
          : "🛋️ lurking";
    return { uid, name: p.name || "?", status, onCouch };
  });
  couch.sort(
    (a, b) =>
      (a.onCouch ? -2 : a.status === "chatty" ? -1 : 1) -
      (b.onCouch ? -2 : b.status === "chatty" ? -1 : 1)
  );
  const voiceCount = couch.filter((c) => c.onCouch).length;
  const hereNow = Math.max(couch.length, member ? 1 : 0);

  // Merge messages and polls into one timeline, then group consecutive
  // same-sender messages (within 5 min) under one avatar.
  type Block =
    | { type: "group"; key: string; sender: string; name: string; own: boolean; msgs: Msg[] }
    | { type: "system"; key: string; m: Msg }
    | { type: "moment"; key: string; m: Msg }
    | { type: "poll"; key: string; p: Poll }
    | { type: "divider"; key: string };

  const timeline: ({ at: string; m: Msg } | { at: string; p: Poll })[] = [
    ...visibleMessages.map((m) => ({ at: m.created_at, m })),
    ...polls.map((p) => ({ at: p.created_at, p })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const blocks: Block[] = [];
  for (const item of timeline) {
    if ("p" in item) {
      blocks.push({ type: "poll", key: `p-${item.p.id}`, p: item.p });
      continue;
    }
    const m = item.m;
    if (m.id === dividerId) blocks.push({ type: "divider", key: "divider" });
    if (m.kind === "system") {
      blocks.push({ type: "system", key: `m-${m.id}`, m });
      continue;
    }
    if (m.kind === "moment") {
      blocks.push({ type: "moment", key: `m-${m.id}`, m });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.type === "group" &&
      last.sender === m.user_id &&
      new Date(m.created_at).getTime() -
        new Date(last.msgs[last.msgs.length - 1].created_at).getTime() <
        5 * 60 * 1000
    ) {
      last.msgs.push(m);
    } else {
      blocks.push({
        type: "group",
        key: `g-${m.id}`,
        sender: m.user_id,
        name: m.display_name,
        own: m.user_id === userId,
        msgs: [m],
      });
    }
  }

  const typerNames = Object.values(typers)
    .filter((t) => t.until > Date.now())
    .map((t) => t.name);
  const typingLine =
    typerNames.length === 0
      ? ""
      : typerNames.length === 1
        ? `${typerNames[0]} is typing`
        : `${typerNames[0]} + ${typerNames.length - 1} other${typerNames.length > 2 ? "s" : ""} are typing`;

  function scrollToMsg(id: number) {
    const el = listRef.current;
    const t = document.getElementById(`msg-${id}`);
    if (!el || !t) return;
    // Manual scrollTop math — scrollIntoView fights the height-locked page
    el.scrollTop += t.getBoundingClientRect().top - el.getBoundingClientRect().top - 60;
  }

  /* ------------------------------------------------------------------------
   * Shared bits of UI
   * ---------------------------------------------------------------------- */

  const pillBtn: React.CSSProperties = {
    width: "auto",
    padding: "7px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    background: "var(--chat-veil)",
    color: acc,
    border: "none",
    borderRadius: 999,
    boxShadow: "0 2px 8px var(--chat-shadow)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const composerCircle = (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    flex: "none",
    padding: 0,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: "var(--accent)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  });

  const menuItem: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "9px 10px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13.5,
    textAlign: "left",
    cursor: "pointer",
  };

  function renderCouchGrid(cols: number, size: number) {
    const cells = couchAll ? couch : couch.slice(0, cols * 2 - 1);
    const extra = couch.length - cells.length;
    // Packed left, wrapping — fixed-width cells so a wide panel just fits
    // more per line instead of spreading the same few out
    const cellW = size + 16;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: cols === 5 ? 9 : 7 }}>
        {cells.map((c) => (
          <span key={c.uid} style={{ width: cellW, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
            {c.uid === userId ? (
              <span
                style={
                  c.status === "chatty" || c.onCouch
                    ? { borderRadius: "50%", boxShadow: "0 0 0 2px var(--card), 0 0 0 3.5px #4ade80" }
                    : undefined
                }
              >
                <Avatar userId={c.uid} name={c.name} size={size} />
              </span>
            ) : (
              <ProfileTrigger userId={c.uid} style={{ width: "auto", display: "inline-flex" }}>
                <span
                  style={
                    c.status === "chatty" || c.onCouch
                      ? { display: "inline-flex", borderRadius: "50%", boxShadow: "0 0 0 2px var(--card), 0 0 0 3.5px #4ade80" }
                      : { display: "inline-flex" }
                  }
                >
                  <Avatar userId={c.uid} name={c.name} size={size} />
                </span>
              </ProfileTrigger>
            )}
            <span
              style={{
                fontSize: 9.5,
                color: sub,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.uid === userId ? "you" : c.status}
            </span>
          </span>
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setCouchAll(true)}
            style={{ width: cellW, flex: "none", padding: 0, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}
          >
            <span
              style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: "var(--card)",
                border: "1.5px dashed rgba(20,116,180,0.4)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              +{extra}
            </span>
            <span style={{ fontSize: 9.5, color: sub }}>see all</span>
          </button>
        )}
      </div>
    );
  }

  function renderCouch(cols: number, size: number) {
    const tall = cols === 5; // the sheet wants ≥44px targets
    return (
      <>
        {couch.length > 0 && <div style={{ marginBottom: 10 }}>{renderCouchGrid(cols, size)}</div>}
        {!inVoice ? (
          <button
            type="button"
            onClick={joinVoice}
            style={{
              width: "100%",
              padding: tall ? "12px 0" : "8px 0",
              borderRadius: 999,
              background: "var(--accent)",
              color: "#131316",
              border: "none",
              fontSize: tall ? 13 : 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🎙️ hop on the couch
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => (micStreamRef.current ? toggleMute() : acquireMic())}
              title={!micStreamRef.current ? "You're listen-only. Tap to turn your mic on" : undefined}
              style={{
                flex: 1,
                width: "auto",
                padding: tall ? "12px 0" : "8px 0",
                borderRadius: 999,
                background: micMuted ? "var(--accent-tint)" : "var(--bubble-soft)",
                color: micMuted ? "var(--accent-tint-text)" : "var(--text)",
                border: "none",
                fontSize: tall ? 13 : 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {!micStreamRef.current ? "🎧 enable mic" : micMuted ? "🔇 unmute" : "🎙️ mute"}
            </button>
            <button
              type="button"
              onClick={leaveVoice}
              style={{
                flex: 1,
                width: "auto",
                padding: tall ? "12px 0" : "8px 0",
                borderRadius: 999,
                background: "var(--card)",
                color: "var(--error)",
                border: "1px solid var(--border)",
                fontSize: tall ? 13 : 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              hang up
            </button>
          </div>
        )}
        {couchAll && couch.length > cols * 2 - 1 && (
          <button
            type="button"
            onClick={() => setCouchAll(false)}
            style={{
              width: "auto",
              marginTop: 6,
              padding: 0,
              background: "transparent",
              border: "none",
              fontSize: 10.5,
              fontWeight: 600,
              color: sub,
              cursor: "pointer",
            }}
          >
            show less
          </button>
        )}
      </>
    );
  }

  function renderWaitingCard() {
    if (!isCreator || requests.length === 0) return null;
    return (
      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: "12px 13px",
          boxShadow: "0 4px 14px var(--chat-shadow)",
        }}
      >
        <PanelLabel color="#0b6f66">waiting room · {requests.length}</PanelLabel>
        {requests.map((r) => (
          <div key={r.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Avatar userId={r.user_id} name={r.display_name} size={26} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.display_name}
                {r.note ? `: “${r.note}”` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => decide(r, true)}
                style={{
                  flex: 1,
                  width: "auto",
                  padding: "5px 0",
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "#131316",
                  border: "none",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                let her in
              </button>
              <button
                type="button"
                onClick={() => decide(r, false)}
                style={{
                  flex: 1,
                  width: "auto",
                  padding: "5px 0",
                  borderRadius: 999,
                  background: "var(--bubble-soft)",
                  color: "var(--muted)",
                  border: "none",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                not now
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ------------------------------------------------------------------------
   * Render
   * ---------------------------------------------------------------------- */

  // A labelled, newcomer-readable opener for the room-life sheet. Shown on
  // phones and on any width where the room-life panel is hidden.
  const voiceChatPill = (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      aria-label={`Voice chat: see who's here and hop on the couch${voiceCount > 0 ? ` (${voiceCount} on voice)` : ""}`}
      style={{
        width: "auto",
        minHeight: 44,
        padding: "5px 13px 5px 7px",
        background: "var(--accent-tint)",
        border: "none",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 16, marginLeft: 4 }} aria-hidden>
        🎙️
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--accent-tint-text)",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        voice chat{voiceCount > 0 ? ` · ${voiceCount}` : ""}
        {voiceCount > 0 && (
          <span
            className="lg-pulse-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--success)",
              display: "inline-block",
              animation: "lgPulse 2.4s ease-in-out infinite",
            }}
            aria-hidden
          />
        )}
      </span>
    </button>
  );

  const header = (
    <header
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: narrow ? 8 : 14,
        padding: narrow
          ? `calc(8px + var(--safe-top)) 10px 8px`
          : `calc(12px + var(--safe-top)) 22px 12px`,
        background: "var(--chat-veil)",
        borderBottom: "1px solid var(--chat-hairline)",
        zIndex: 7,
      }}
    >
      {narrow && (
        <button
          type="button"
          onClick={() => router.push("/chat")}
          aria-label="All rooms"
          style={{ ...composerCircle(44) }}
        >
          <span className="msr" style={{ fontSize: 22 }} aria-hidden>
            arrow_back
          </span>
        </button>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <h1
            className="lg-serif"
            style={{
              margin: 0,
              fontSize: narrow ? 20 : 23,
              fontWeight: 700,
              lineHeight: 1.1,
              color: ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {room.name}
          </h1>
          {room.is_private && (
            <span className="msr" style={{ fontSize: 15, color: sub }} title="Private room" aria-label="Private room">
              lock
            </span>
          )}
          {!narrow && room.tags?.length > 0 && (
            <span style={{ fontSize: 12, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {room.tags.map((t) => `#${t}`).join(" ")}
            </span>
          )}
        </div>
        <p style={{ margin: "2px 0 0", fontSize: narrow ? 11.5 : 12, color: acc }}>
          <span
            className="lg-pulse-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--success)",
              display: "inline-block",
              marginRight: 5,
              animation: "lgPulse 2.4s ease-in-out infinite",
            }}
            aria-hidden
          />
          {member ? `${hereNow} here now · ` : ""}
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </p>
      </div>
      {narrow ? (
        <>{member && voiceChatPill}</>
      ) : (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          {/* No room-life panel below 1080px — the sheet is the way onto the couch */}
          {member && panelHidden && voiceChatPill}
          {room.rules && (
            <button type="button" style={pillBtn} onClick={() => setShowRules((v) => !v)}>
              ✦ room rules
            </button>
          )}
          {member && (
            <button
              type="button"
              onClick={copyInvite}
              style={{
                width: "auto",
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                background: "var(--accent)",
                color: "#131316",
                border: "none",
                borderRadius: 999,
                boxShadow: "0 4px 12px rgba(20,116,180,0.35)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              invite a girl
            </button>
          )}
          {member && (
            <button
              type="button"
              onClick={() => setHeaderMenu((v) => !v)}
              aria-expanded={headerMenu}
              aria-label="Room actions"
              style={{ ...pillBtn, padding: "7px 9px", display: "inline-flex" }}
            >
              <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                more_horiz
              </span>
            </button>
          )}
          {headerMenu && (
            <div
              style={{
                position: "absolute",
                top: 40,
                right: 0,
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                minWidth: 190,
                padding: 6,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                boxShadow: "0 14px 34px var(--lift)",
              }}
            >
              {!onNative && (
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => {
                    setHeaderMenu(false);
                    window.open(window.location.pathname, "_blank", "popup=yes,width=980,height=760");
                  }}
                >
                  <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                    open_in_new
                  </span>
                  Pop out
                </button>
              )}
              <button
                type="button"
                style={menuItem}
                onClick={() => {
                  setHeaderMenu(false);
                  setShowCelebrate(true);
                }}
              >
                <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                  celebration
                </span>
                Celebrate & announce
              </button>
              {isCreator && (
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => {
                    setHeaderMenu(false);
                    setShowSettings((v) => !v);
                  }}
                >
                  <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                    settings
                  </span>
                  Settings{requests.length > 0 ? ` (${requests.length})` : ""}
                </button>
              )}
              {member && !isCreator && (
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => {
                    setHeaderMenu(false);
                    leave();
                  }}
                >
                  <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                    logout
                  </span>
                  Leave the room
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );

  return (
    <main
      className="lg-room-lock"
      style={{
        background: surface.grad,
        display: "flex",
        flexDirection: "column",
        color: ink,
        transition: "background .3s",
      }}
    >
      {header}

      {/* Mobile pins chip */}
      {narrow && member && pinned.length > 0 && (
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px 8px",
            background: "var(--chat-veil-soft)",
          }}
        >
          <button
            type="button"
            onClick={() => setPinsOpen((v) => !v)}
            style={{
              flex: "none",
              width: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "var(--card)",
              border: "none",
              borderRadius: 999,
              padding: "6px 12px",
              boxShadow: "0 2px 8px var(--chat-shadow)",
              fontSize: 11.5,
              fontWeight: 700,
              color: acc,
              cursor: "pointer",
            }}
          >
            <span className="msr" style={{ fontSize: 14 }} aria-hidden>
              push_pin
            </span>
            pins · {pinned.length}
          </button>
        </div>
      )}

      {/* Pinned strip (desktop) / expanded pin list (both) */}
      {member && pinned.length > 0 && !narrow && !pinsOpen && (
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 22px",
            background: "var(--chat-veil-soft)",
          }}
        >
          <span className="msr" style={{ fontSize: 14, color: acc }} aria-hidden>
            push_pin
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: acc,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            <strong>pinned:</strong> {pinned.map((m) => pinLabel(m)).join(" · ")}
          </span>
          <button
            type="button"
            onClick={() => setPinsOpen(true)}
            style={{
              marginLeft: "auto",
              width: "auto",
              padding: 0,
              background: "transparent",
              border: "none",
              fontSize: 11.5,
              fontWeight: 600,
              color: sub,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            see all ›
          </button>
        </div>
      )}
      {member && pinsOpen && pinned.length > 0 && (
        <div
          style={{
            flex: "none",
            margin: narrow ? "8px 12px 0" : "8px 22px 0",
            padding: "8px 12px",
            borderRadius: 10,
            background: "var(--chat-veil)",
          }}
        >
          {pinned.map((m) => (
            // Tapping a pin travels to the message it points at
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setPinsOpen(false);
                scrollToMsg(m.id);
              }}
              title="Go to this message"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "4px 0",
                background: "transparent",
                border: "none",
                textAlign: "left",
                color: acc,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                push_pin
              </span>
              <span style={{ fontWeight: 700, flex: "none" }}>{m.display_name}:</span>
              {m.kind === "image" || m.kind === "gif" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.content}
                  alt="Pinned photo"
                  style={{ height: 36, width: 48, objectFit: "cover", borderRadius: 6, display: "block" }}
                />
              ) : (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {pinLabel(m)}
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPinsOpen(false)}
            style={{
              width: "auto",
              padding: 0,
              background: "transparent",
              border: "none",
              fontSize: 11.5,
              fontWeight: 600,
              color: sub,
              cursor: "pointer",
            }}
          >
            hide pins
          </button>
        </div>
      )}

      {showRules && room.rules && (
        <div
          style={{
            flex: "none",
            margin: narrow ? "8px 12px 0" : "8px 22px 0",
            padding: "10px 14px",
            borderRadius: 12,
            background: "var(--card)",
            boxShadow: "0 2px 8px var(--chat-shadow)",
          }}
        >
          <p style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text)" }}>{room.rules}</p>
        </div>
      )}

      {error && (
        <p className="msg-error" style={{ flex: "none", margin: narrow ? "8px 12px 0" : "8px 22px 0" }}>
          {error}
        </p>
      )}
      {notice && (
        <p style={{ flex: "none", margin: narrow ? "8px 12px 0" : "8px 22px 0", fontSize: 13, color: acc }}>
          {notice}
        </p>
      )}
      {welcomeBanner && (
        <div
          style={{
            flex: "none",
            margin: narrow ? "8px 12px 0" : "8px 22px 0",
            padding: "10px 14px",
            borderRadius: 12,
            background: "var(--card)",
            border: "1px solid var(--accent)",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--text)" }}>{welcomeBanner}</p>
        </div>
      )}

      {isCreator && showSettings && (
        <form
          onSubmit={saveSettings}
          className="card"
          // The page is height-locked for the sticky composer, so the long
          // settings form scrolls inside itself
          style={{
            flex: "none",
            maxWidth: "none",
            margin: narrow ? "8px 12px 0" : "8px 22px 0",
            maxHeight: "58vh",
            overflowY: "auto",
          }}
        >
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Room settings</h2>
          <label>Name</label>
          <input value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} maxLength={60} />
          <label>Description</label>
          <textarea
            value={room.description}
            onChange={(e) => setRoom({ ...room, description: e.target.value })}
            maxLength={300}
            rows={3}
          />
          <label>Tags (comma separated)</label>
          <input
            value={room.tags?.join(", ") ?? ""}
            onChange={(e) =>
              setRoom({
                ...room,
                tags: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
              })
            }
          />
          <label>Room picture</label>
          <ImagePicker
            id="settings-room-image"
            imageUrl={room.image_url}
            uploading={uploading}
            onFile={async (file) => {
              setUploading(true);
              setError("");
              try {
                const url = await uploadRoomImage(supabase, userId, file);
                setRoom({ ...room, image_url: url });
                // Persist immediately so the picture sticks even without hitting Save
                await supabase.from("chat_rooms").update({ image_url: url }).eq("id", room.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed.");
              }
              setUploading(false);
            }}
          />
          <label>Background colour</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setRoom({ ...room, bg_color: c })}
                aria-label={`Colour ${c}`}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: 8,
                  background: roomSurface(c).bg,
                  border: c === room.bg_color ? "2px solid var(--accent)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>
          <label>Welcome message</label>
          <input
            value={room.welcome_message}
            onChange={(e) => setRoom({ ...room, welcome_message: e.target.value })}
            maxLength={200}
          />
          <label>Rules</label>
          <input value={room.rules} onChange={(e) => setRoom({ ...room, rules: e.target.value })} maxLength={500} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={room.is_private}
              onChange={(e) => setRoom({ ...room, is_private: e.target.checked })}
              style={{ width: "auto", margin: 0 }}
            />
            Private room
          </label>
          <button className="primary" type="submit">
            Save settings
          </button>
        </form>
      )}

      {!member ? (
        <div className="card" style={{ margin: "40px auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>{room.name}</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
            {room.description || "No description yet."}
          </p>
          {!room.is_private ? (
            <button className="primary" onClick={join}>
              Join the room
            </button>
          ) : myRequest ? (
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              {myRequest.status === "pending" && "Your request is in the waiting room."}
              {myRequest.status === "denied" && "Your request wasn't accepted this time."}
              {myRequest.status === "approved" && (
                <button className="primary" onClick={join}>
                  You&apos;re in. Enter the room
                </button>
              )}
            </p>
          ) : (
            <form onSubmit={requestAccess}>
              <label>Request a spot (add a note for the creator)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="hey! I'd love to join because..." />
              <button className="primary" type="submit">
                Request to join
              </button>
            </form>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* Chat column */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              padding: narrow ? "0 12px" : "0 24px",
            }}
          >
            <div
              ref={listRef}
              onScroll={() => {
                const el = listRef.current;
                if (!el) return;
                const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
                stickRef.current = near;
                setShowJump(!near);
                if (near) setNewBelow(0);
              }}
              style={{
                flex: 1,
                overflowY: "auto",
                margin: "10px 0 0",
                padding: "4px 0 10px",
                display: "flex",
                flexDirection: "column",
                gap: narrow ? 10 : 11,
                minHeight: 0,
              }}
            >
              {hasMore && (
                <button
                  onClick={loadEarlier}
                  style={{
                    width: "auto",
                    alignSelf: "center",
                    padding: "4px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--chat-veil)",
                    color: sub,
                    cursor: "pointer",
                  }}
                >
                  Load earlier messages
                </button>
              )}
              {blocks.map((block) => {
                if (block.type === "divider") {
                  return (
                    <div
                      key={block.key}
                      style={{
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "#b0387a",
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ flex: 1, borderTop: "1.5px solid #f3c4dd" }} aria-hidden />
                      {dividerCount} new while you were away ✨
                      <span style={{ flex: 1, borderTop: "1.5px solid #f3c4dd" }} aria-hidden />
                    </div>
                  );
                }
                if (block.type === "system") {
                  return (
                    <p key={block.key} style={{ textAlign: "center", fontSize: 12, color: sub, margin: 0 }}>
                      {block.m.content}
                    </p>
                  );
                }
                if (block.type === "moment") {
                  const payload = momentPayload(block.m.content);
                  const mt = momentTypeOf(payload?.type);
                  const c = cheers[block.m.id] ?? { count: 0, mine: false };
                  return (
                    <div
                      key={block.key}
                      id={`msg-${block.m.id}`}
                      style={{
                        flex: "none",
                        position: "relative",
                        alignSelf: "center",
                        width: narrow ? 320 : 380,
                        maxWidth: "100%",
                        background: mt.grad,
                        borderRadius: narrow ? 16 : 18,
                        padding: "13px 16px",
                        boxShadow: "0 6px 20px rgba(20,116,180,0.14)",
                        textAlign: "center",
                        overflow: "hidden",
                      }}
                    >
                      <span aria-hidden style={{ position: "absolute", top: 10, left: 18, width: 6, height: 6, borderRadius: "50%", background: "#f2c452" }} />
                      <span aria-hidden style={{ position: "absolute", top: 22, right: 30, width: 5, height: 5, borderRadius: "50%", background: "#db2777" }} />
                      <span aria-hidden style={{ position: "absolute", bottom: 14, left: 40, width: 5, height: 5, borderRadius: 2, background: "#38b6ff", transform: "rotate(24deg)" }} />
                      <span aria-hidden style={{ position: "absolute", top: 8, right: 90, width: 4, height: 8, borderRadius: 2, background: "#0d9488", transform: "rotate(-18deg)" }} />
                      <span aria-hidden style={{ position: "absolute", bottom: 20, right: 56, width: 6, height: 6, borderRadius: "50%", background: "#f2c452" }} />
                      <p className="lg-serif" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#2b2733" }}>
                        {payload ? mt.title(payload.name) : block.m.content}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(43,39,51,0.55)" }}>
                        from {block.m.user_id === userId ? "you" : block.m.display_name}
                      </p>
                      <button
                        type="button"
                        onClick={() => cheerMoment(block.m, mt.confetti)}
                        style={{
                          width: "auto",
                          marginTop: 7,
                          padding: narrow ? "10px 16px" : "7px 16px",
                          fontSize: 12.5,
                          fontWeight: 700,
                          background: "#ffffff",
                          color: "#b0387a",
                          border: "none",
                          borderRadius: 999,
                          boxShadow: "0 3px 10px rgba(219,39,119,0.2)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap" }}>
                          {mt.cheer}
                          {c.count > 0 ? ` (${c.count})` : ""}
                        </span>
                      </button>
                    </div>
                  );
                }
                if (block.type === "poll") {
                  return (
                    <div key={block.key} style={{ flex: "none", display: "flex", gap: 10 }}>
                      {!narrow && <span style={{ width: 34, flex: "none" }} aria-hidden />}
                      <PollCard
                        poll={block.p}
                        votes={votes[block.p.id] ?? []}
                        userId={userId}
                        narrow={narrow}
                        onVote={votePoll}
                      />
                    </div>
                  );
                }

                // Grouped bubbles
                const own = block.own;
                const p = personTheme(block.sender);
                const avSize = narrow ? 30 : 34;
                return (
                  <div
                    key={block.key}
                    style={{
                      flex: "none",
                      display: "flex",
                      gap: narrow ? 8 : 10,
                      alignItems: "flex-end",
                      justifyContent: own ? "flex-end" : "flex-start",
                    }}
                  >
                    {!own && (
                      // width:auto beats the global button{width:100%} — without
                      // it the trigger swallows the row and the avatar floats
                      <ProfileTrigger
                        userId={block.sender}
                        style={{ width: "auto", flex: "none", display: "inline-flex" }}
                      >
                        <Avatar userId={block.sender} name={block.name} size={avSize} />
                      </ProfileTrigger>
                    )}
                    <div
                      style={{
                        minWidth: 0,
                        maxWidth: "78%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        alignItems: own ? "flex-end" : "flex-start",
                      }}
                    >
                      {!own && (
                        <p
                          style={{
                            margin: `0 0 -1px ${narrow ? 12 : 14}px`,
                            fontSize: narrow ? 11.5 : 12,
                            fontWeight: 700,
                            color: p.name,
                          }}
                        >
                          {block.name}
                          <span style={{ fontWeight: 500, color: "#9a8fb8", fontSize: narrow ? 10.5 : 11, marginLeft: 4 }}>
                            {msgTime(block.msgs[0].created_at)}
                          </span>
                        </p>
                      )}
                      {own && (
                        <p style={{ margin: "0 2px -1px 0", fontSize: 10.5, fontWeight: 500, color: "#9a8fb8" }}>
                          {msgTime(block.msgs[0].created_at)}
                        </p>
                      )}
                      {block.msgs.map((m, j) => {
                        const radius = own
                          ? j === 0
                            ? `18px 18px 5px 18px`
                            : `18px 5px 5px 18px`
                          : j === 0
                            ? `18px 18px 18px 5px`
                            : `5px 18px 18px 5px`;
                        // Photos and GIFs go bare — just the rounded image, no bubble
                        const bare = m.kind === "image" || m.kind === "gif";
                        const orig =
                          m.reply_to_id != null ? messages.find((x) => x.id === m.reply_to_id) : undefined;
                        const rGroups = Object.entries(
                          (reactions[m.id] ?? []).reduce(
                            (accu, r) => {
                              accu[r.emoji] = accu[r.emoji] ?? { count: 0, mine: false };
                              accu[r.emoji].count += 1;
                              if (r.user_id === userId) accu[r.emoji].mine = true;
                              return accu;
                            },
                            {} as Record<string, { count: number; mine: boolean }>
                          )
                        );
                        return (
                          <div
                            key={m.id}
                            id={`msg-${m.id}`}
                            className={`lg-msg-wrap${own ? " own" : ""}`}
                            style={{ maxWidth: "100%" }}
                          >
                            <div
                              onClick={() => setTappedFor((cur) => (cur === m.id ? null : m.id))}
                              style={{
                                background: bare
                                  ? "transparent"
                                  : own
                                    ? "linear-gradient(135deg, #8fd3ff, #4fbcff)"
                                    : "var(--bubble)",
                                color: own ? "#0c2c44" : "var(--bubble-ink)",
                                borderRadius: radius,
                                padding: bare
                                  ? 0
                                  : m.kind === "voice"
                                    ? "8px 13px"
                                    : narrow
                                      ? "8px 13px"
                                      : "9px 14px",
                                boxShadow: bare
                                  ? "none"
                                  : own
                                    ? "0 3px 10px rgba(20,116,180,0.28)"
                                    : "0 1px 3px var(--chat-shadow)",
                                fontSize: narrow ? 14 : 14.5,
                                lineHeight: 1.45,
                                wordBreak: "break-word",
                              }}
                            >
                              {orig !== undefined || m.reply_to_id != null ? (
                                <p
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (orig) scrollToMsg(orig.id);
                                  }}
                                  style={{
                                    fontSize: 12,
                                    color: orig ? personTheme(orig.user_id).name : "inherit",
                                    opacity: orig ? 1 : 0.7,
                                    borderLeft: `2.5px solid ${orig ? personTheme(orig.user_id).soft : "currentColor"}`,
                                    paddingLeft: 8,
                                    margin: "0 0 4px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    cursor: orig ? "pointer" : "default",
                                  }}
                                >
                                  {orig ? excerptOf(orig, orig.user_id === userId) : "Earlier message"}
                                </p>
                              ) : null}
                              {m.kind === "voice" ? (
                                <VoiceBubble m={m} />
                              ) : m.kind === "gif" || m.kind === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.content}
                                  alt={m.kind === "image" ? "photo" : "gif"}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: 380,
                                    borderRadius: radius,
                                    display: "block",
                                    boxShadow: "0 1px 3px var(--chat-shadow)",
                                  }}
                                />
                              ) : (
                                <span style={{ whiteSpace: "pre-wrap" }}>
                                  {renderMessageContent(m.content).map((part, i) =>
                                    typeof part === "string" ? (
                                      <span key={i}>{part}</span>
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        key={i}
                                        src={part.url}
                                        alt={part.name}
                                        title={part.name}
                                        style={{
                                          width: 20,
                                          height: 20,
                                          objectFit: "cover",
                                          borderRadius: 4,
                                          verticalAlign: "middle",
                                          margin: "0 1px",
                                        }}
                                      />
                                    )
                                  )}
                                  {m.edited_at && (
                                    <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 5 }}>(edited)</span>
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Floating toolbar: hover on desktop, tap on touch */}
                            <span className={`lg-msg-tools${tappedFor === m.id ? " open" : ""}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setReactPickerFor(reactPickerFor === m.id ? null : m.id);
                                  setMsgMenuFor(null);
                                }}
                                aria-label="React to this message"
                                title="React"
                              >
                                <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                                  add_reaction
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTo(m);
                                  setEditingMsg(null);
                                  inputRef.current?.focus();
                                }}
                                aria-label="Reply to this message"
                                title="Reply"
                              >
                                <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                                  reply
                                </span>
                              </button>
                              {(isCreator || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => togglePin(m)}
                                  aria-label={m.pinned ? "Unpin this message" : "Pin this message"}
                                  title={m.pinned ? "Unpin" : "Pin"}
                                >
                                  <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                                    push_pin
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setMsgMenuFor(msgMenuFor === m.id ? null : m.id);
                                  setReactPickerFor(null);
                                }}
                                aria-label="More actions"
                                title="More"
                              >
                                <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                                  more_horiz
                                </span>
                              </button>
                            </span>

                            {reactPickerFor === m.id && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 2,
                                  margin: "4px 0 0 8px",
                                  background: "var(--card)",
                                  borderRadius: 999,
                                  padding: "2px 6px",
                                  boxShadow: "0 4px 14px rgba(44,38,53,0.18)",
                                  width: "fit-content",
                                }}
                              >
                                {QUICK_REACTIONS.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => toggleReaction(m, em)}
                                    aria-label={`React with ${em}`}
                                    style={{
                                      width: "auto",
                                      padding: "0 3px",
                                      fontSize: 18,
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            )}

                            {msgMenuFor === m.id && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  margin: "4px 0 0 8px",
                                  background: "var(--card)",
                                  borderRadius: 999,
                                  padding: "3px 10px",
                                  boxShadow: "0 4px 14px rgba(44,38,53,0.18)",
                                  width: "fit-content",
                                  fontSize: 12,
                                }}
                              >
                                {own && m.kind === "text" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMsg(m);
                                      setReplyTo(null);
                                      setInput(m.content);
                                      setMsgMenuFor(null);
                                      inputRef.current?.focus();
                                    }}
                                    style={{ width: "auto", padding: "3px 4px", background: "transparent", border: "none", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
                                  >
                                    Edit
                                  </button>
                                )}
                                {!own && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMsgMenuFor(null);
                                      setReportFor(m);
                                      setReportReason("");
                                    }}
                                    style={{ width: "auto", padding: "3px 4px", background: "transparent", border: "none", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
                                  >
                                    Report
                                  </button>
                                )}
                                {(own || isAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMsgMenuFor(null);
                                      deleteMessage(m);
                                    }}
                                    style={{ width: "auto", padding: "3px 4px", background: "transparent", border: "none", color: "var(--error)", fontSize: 12, cursor: "pointer" }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}

                            {rGroups.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 5,
                                  flexWrap: "wrap",
                                  margin: own ? "2px 8px 0 0" : "2px 0 0 8px",
                                  justifyContent: own ? "flex-end" : "flex-start",
                                }}
                              >
                                {rGroups.map(([emoji, g]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => toggleReaction(m, emoji)}
                                    aria-label={`${g.count} ${emoji} reaction${g.count === 1 ? "" : "s"}${g.mine ? ", including yours" : ""}`}
                                    style={{
                                      width: "auto",
                                      padding: "2px 9px",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                      flex: "none",
                                      borderRadius: 999,
                                      background: g.mine ? "var(--accent-tint)" : "var(--card)",
                                      border: g.mine ? "1px solid var(--accent)" : "1px solid transparent",
                                      color: g.mine ? "var(--accent-tint-text)" : "var(--text)",
                                      boxShadow: g.mine ? "none" : "0 1px 3px var(--chat-shadow)",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {emoji} {g.count}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Emoji bursts float up the right edge */}
            <div className="lg-burst-layer" aria-hidden>
              {bursts.map((b) => (
                <span key={b.id} className="lg-burst-glyph" style={{ right: b.x }}>
                  {b.emoji}
                </span>
              ))}
            </div>

            {(showJump || newBelow > 0) && (
              <button
                type="button"
                onClick={() => {
                  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                  setNewBelow(0);
                }}
                aria-label="Jump to latest messages"
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  bottom: 118,
                  width: "auto",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "#2c2635",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 6px 18px rgba(44,38,53,0.3)",
                  zIndex: 5,
                  cursor: "pointer",
                }}
              >
                <span className="msr" style={{ fontSize: 15 }} aria-hidden>
                  arrow_downward
                </span>
                {newBelow > 0 ? `${newBelow} new` : "latest"}
              </button>
            )}

            {showEmoji && (
              <div
                className="card"
                style={{ flex: "none", maxWidth: "none", margin: "8px 0", padding: 12, maxHeight: 240, overflowY: "auto" }}
              >
                <input
                  placeholder="Search emojis..."
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  style={{ marginBottom: 10, padding: "6px 10px", fontSize: 13 }}
                />
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 4px" }}>Yours</p>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    {customEmojis.map((em) => (
                      <span key={em.id} style={{ position: "relative", display: "inline-block" }}>
                        <button
                          type="button"
                          title={em.name}
                          aria-label={em.name}
                          onClick={() => setInput((v) => v + `{{emoji:${em.image_url}|${em.name}}}`)}
                          style={{
                            width: 34,
                            height: 34,
                            padding: 2,
                            background: "transparent",
                            border: "none",
                            borderRadius: 6,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={em.image_url}
                            alt={em.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${em.name} emoji`}
                          title={`Remove :${em.name}:`}
                          onClick={() => deleteCustomEmoji(em)}
                          style={{
                            position: "absolute",
                            top: -3,
                            right: -3,
                            width: 14,
                            height: 14,
                            padding: 0,
                            borderRadius: "50%",
                            fontSize: 9,
                            lineHeight: 1,
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            color: "var(--muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowAddEmoji((v) => !v)}
                      aria-label="Add a custom emoji"
                      title="Add your own emoji"
                      style={{
                        width: 34,
                        height: 34,
                        padding: 0,
                        fontSize: 18,
                        lineHeight: 1,
                        background: "transparent",
                        border: "1px dashed var(--border)",
                        borderRadius: 6,
                        color: "var(--muted)",
                      }}
                    >
                      +
                    </button>
                  </div>
                  {showAddEmoji && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <input
                        placeholder="name"
                        value={newEmojiName}
                        onChange={(e) => setNewEmojiName(e.target.value)}
                        maxLength={32}
                        style={{ width: 100, padding: "4px 8px", fontSize: 12, marginBottom: 0 }}
                      />
                      <input
                        id="custom-emoji-file"
                        type="file"
                        accept="image/*"
                        disabled={emojiUploading}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) addCustomEmoji(file);
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor="custom-emoji-file"
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          cursor: emojiUploading ? "wait" : "pointer",
                        }}
                      >
                        {emojiUploading ? "Uploading…" : "Choose image"}
                      </label>
                    </div>
                  )}
                  {emojiError && (
                    <p className="msg-error" style={{ fontSize: 11, marginTop: 4 }}>
                      {emojiError}
                    </p>
                  )}
                </div>
                {EMOJI_CATS.map(([cat, label]) => {
                  const q = emojiSearch.trim().toLowerCase();
                  const items = EMOJI_SET.filter(
                    ([, name, c]) => c === cat && (!q || name.includes(q))
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 6 }}>
                      <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 4px" }}>{label}</p>
                      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        {items.map(([em, name]) => (
                          <button
                            key={em}
                            type="button"
                            title={name}
                            aria-label={name}
                            onClick={() => setInput((v) => v + em)}
                            style={{
                              width: 34,
                              height: 34,
                              padding: 0,
                              fontSize: 20,
                              background: "transparent",
                              border: "none",
                              borderRadius: 6,
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showPollForm && (
              <form
                onSubmit={createPoll}
                className="card"
                style={{ flex: "none", maxWidth: "none", margin: "8px 0", padding: 14 }}
              >
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>New poll ✨</h3>
                <input
                  placeholder="the question…"
                  value={pollQ}
                  onChange={(e) => setPollQ(e.target.value)}
                  maxLength={200}
                  style={{ marginBottom: 8 }}
                />
                {pollOpts.map((opt, i) => (
                  <input
                    key={i}
                    placeholder={`option ${i + 1}`}
                    value={opt}
                    onChange={(e) =>
                      setPollOpts((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    maxLength={80}
                    style={{ marginBottom: 8 }}
                  />
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {pollOpts.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOpts((prev) => [...prev, ""])}
                      style={{ width: "auto", padding: "6px 12px", fontSize: 12, borderRadius: 999, background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--muted)" }}
                    >
                      + option
                    </button>
                  )}
                  <select
                    value={pollCloseMins}
                    onChange={(e) => setPollCloseMins(Number(e.target.value))}
                    aria-label="When the poll closes"
                    style={{
                      width: "auto",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    <option value={0}>stays open</option>
                    <option value={60}>closes in 1 hour</option>
                    <option value={180}>closes in 3 hours</option>
                    <option value={1440}>closes tomorrow</option>
                  </select>
                  <button
                    className="primary"
                    type="submit"
                    style={{ width: "auto", padding: "6px 16px", fontSize: 13, marginLeft: "auto" }}
                  >
                    Ask the room
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPollForm(false)}
                    style={{ width: "auto", padding: "6px 12px", fontSize: 13, background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {showCelebrate && (
              <form
                onSubmit={celebrate}
                className="card"
                style={{ flex: "none", maxWidth: "none", margin: "8px 0", padding: 14 }}
              >
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Celebrate & announce ✨</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {MOMENT_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setMomentType(t.key)}
                      aria-pressed={momentType === t.key}
                      style={{
                        width: "auto",
                        padding: "5px 12px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 999,
                        background: momentType === t.key ? "var(--accent-tint)" : "var(--bg)",
                        color: momentType === t.key ? "var(--accent-tint-text)" : "var(--muted)",
                        border: momentType === t.key ? "1px solid var(--accent)" : "1px solid var(--border)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.icon} {t.chip}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    autoFocus
                    placeholder={MOMENT_TYPES.find((t) => t.key === momentType)?.placeholder}
                    value={celebrateName}
                    onChange={(e) => setCelebrateName(e.target.value)}
                    maxLength={80}
                    style={{ flex: 1, minWidth: 160, marginBottom: 0 }}
                  />
                  <button
                    className="primary"
                    type="submit"
                    style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
                  >
                    Post the card
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCelebrate(false)}
                    style={{ width: "auto", padding: "8px 12px", fontSize: 13, background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {reportFor && (
              <form
                onSubmit={sendReport}
                className="card"
                style={{ flex: "none", maxWidth: "none", margin: "8px 0", padding: 14 }}
              >
                <h3 style={{ fontSize: 14, marginBottom: 4 }}>Report {reportFor.display_name}&apos;s message</h3>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  A sentence about what&apos;s wrong helps the admins act on it.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    autoFocus
                    placeholder="what's wrong with it?"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    maxLength={500}
                    style={{ flex: 1, minWidth: 160, marginBottom: 0 }}
                  />
                  <button
                    className="primary"
                    type="submit"
                    style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
                  >
                    Send report
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportFor(null)}
                    style={{ width: "auto", padding: "8px 12px", fontSize: 13, background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {amBanned ? (
              <p style={{ flex: "none", fontSize: 13, color: sub, textAlign: "center", padding: "10px 0 14px" }}>
                Your account is banned from posting. If you think this is a mistake, reach out via
                the Support page.
              </p>
            ) : (
              <div style={{ flex: "none", padding: `6px 0 calc(${narrow ? 14 : 16}px + var(--safe-bottom))`, position: "relative" }}>
                {/* Typing + burst rail */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 7,
                    fontSize: 11.5,
                    color: sub,
                    minHeight: narrow ? 34 : 30,
                  }}
                >
                  {typingLine && (
                    <>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {typingLine}
                      </span>
                      <TypingDots />
                    </>
                  )}
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {!narrow && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#9a8fb8",
                        }}
                      >
                        burst
                      </span>
                    )}
                    {BURSTS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => sendBurst(em)}
                        aria-label={`Send a ${em} burst`}
                        title="Bursts float up for everyone"
                        style={{
                          width: narrow ? 34 : 30,
                          height: narrow ? 34 : 30,
                          flex: "none",
                          padding: 0,
                          borderRadius: "50%",
                          background: "var(--chat-veil)",
                          boxShadow: "0 2px 8px var(--chat-shadow)",
                          border: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: narrow ? 17 : 15,
                          cursor: "pointer",
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </span>
                </div>

                {pendingPhoto && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "0 0 8px",
                      padding: 8,
                      background: "var(--card)",
                      borderRadius: 14,
                      boxShadow: "0 4px 14px var(--chat-shadow)",
                      width: "fit-content",
                      maxWidth: "100%",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingPhoto.url}
                      alt="Photo to send"
                      style={{ height: 72, maxWidth: 140, objectFit: "cover", borderRadius: 10, display: "block" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Send this photo to the room?</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="primary"
                          onClick={confirmSendPhoto}
                          disabled={attachBusy}
                          style={{ width: "auto", padding: "6px 16px", fontSize: 13, borderRadius: 999 }}
                        >
                          {attachBusy ? "Sending…" : "Send photo"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelPhoto}
                          disabled={attachBusy}
                          style={{ width: "auto", padding: "6px 12px", fontSize: 13, borderRadius: 999, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(replyTo || editingMsg) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: sub,
                      margin: "0 0 6px",
                    }}
                  >
                    <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                      {editingMsg ? "edit" : "reply"}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {editingMsg
                        ? "Editing your message"
                        : `Replying to ${
                            replyTo!.user_id === userId ? "yourself" : replyTo!.display_name
                          }: ${previewText(replyTo!).slice(0, 60)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        if (editingMsg) {
                          setEditingMsg(null);
                          setInput("");
                        }
                      }}
                      aria-label={editingMsg ? "Cancel editing" : "Cancel reply"}
                      style={{
                        width: 20,
                        height: 20,
                        padding: 0,
                        borderRadius: "50%",
                        fontSize: 12,
                        lineHeight: 1,
                        background: "transparent",
                        border: "1px solid var(--border)",
                        color: "inherit",
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Composer pill */}
                <div style={{ position: "relative" }}>
                  {showAttach && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 8px)",
                        left: 0,
                        zIndex: 30,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 180,
                        padding: 6,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        boxShadow: "0 14px 34px var(--lift)",
                      }}
                    >
                      <label htmlFor="chat-photo-file" style={{ ...menuItem, margin: 0, cursor: attachBusy ? "wait" : "pointer" }}>
                        <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                          image
                        </span>
                        Send a photo
                      </label>
                      <button
                        type="button"
                        style={menuItem}
                        onClick={() => {
                          setShowAttach(false);
                          setShowPollForm(true);
                        }}
                      >
                        <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                          ballot
                        </span>
                        Start a poll
                      </button>
                      <button
                        type="button"
                        style={menuItem}
                        onClick={() => {
                          setShowAttach(false);
                          setShowCelebrate(true);
                        }}
                      >
                        <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                          celebration
                        </span>
                        Celebrate & announce
                      </button>
                    </div>
                  )}
                  <form
                    onSubmit={send}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: narrow ? 4 : 6,
                      background: "var(--card)",
                      borderRadius: 999,
                      padding: narrow ? "5px 5px 5px 6px" : "6px 6px 6px 8px",
                      boxShadow: "0 8px 24px var(--chat-shadow)",
                    }}
                  >
                    <input
                      id="chat-photo-file"
                      type="file"
                      accept="image/*"
                      disabled={attachBusy}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        setShowAttach(false);
                        const file = e.target.files?.[0];
                        if (file) pickPhoto(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAttach((v) => !v)}
                      aria-label="Add to the chat"
                      aria-expanded={showAttach}
                      title="Photos, polls…"
                      style={{
                        ...composerCircle(narrow ? 44 : 34),
                        background: "var(--bubble-soft)",
                      }}
                    >
                      <span className="msr" style={{ fontSize: narrow ? 22 : 20, lineHeight: 1, display: "block" }} aria-hidden>
                        {attachBusy ? "hourglass_top" : "add"}
                      </span>
                    </button>
                    {!narrow && (
                      <button
                        type="button"
                        onClick={() => setShowEmoji((v) => !v)}
                        aria-label="Emoji picker"
                        title="Emoji"
                        style={composerCircle(34)}
                      >
                        <span className="msr" style={{ fontSize: 20, lineHeight: 1, display: "block" }} aria-hidden>
                          mood
                        </span>
                      </button>
                    )}
                    {recording ? (
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 14,
                          color: "#b0387a",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          className="lg-pulse-dot"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#db2777",
                            animation: "lgPulse 1.4s ease-in-out infinite",
                          }}
                          aria-hidden
                        />
                        recording… {recSecs}s, release to send
                      </span>
                    ) : (
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value);
                          pingTyping();
                        }}
                        placeholder={editingMsg ? "Edit your message" : "say something…"}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          margin: 0,
                          border: "none",
                          background: "transparent",
                          height: narrow ? 44 : 34,
                          padding: "0 6px",
                          boxSizing: "border-box",
                          fontSize: 14.5,
                          color: "var(--text)",
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startRecording();
                      }}
                      onPointerUp={() => stopRecording(false)}
                      onPointerLeave={() => recording && stopRecording(false)}
                      onContextMenu={(e) => e.preventDefault()}
                      aria-label="Hold to record a voice note"
                      title="Hold to record a voice note"
                      style={{
                        ...composerCircle(narrow ? 44 : 34),
                        background: "#fbe0ef",
                        color: "#b0387a",
                        touchAction: "none",
                      }}
                    >
                      <span className="msr" style={{ fontSize: narrow ? 22 : 20, lineHeight: 1, display: "block" }} aria-hidden>
                        mic
                      </span>
                    </button>
                    <button
                      type="submit"
                      aria-label={editingMsg ? "Save edit" : "Send message"}
                      title={editingMsg ? "Save" : "Send"}
                      style={{
                        ...composerCircle(narrow ? 44 : 38),
                        background: "linear-gradient(135deg, #4dbdff, #1ea5f5)",
                        color: "#ffffff",
                        boxShadow: "0 4px 12px rgba(20,116,180,0.4)",
                      }}
                    >
                      <span className="msr" style={{ fontSize: narrow ? 21 : 19, lineHeight: 1, display: "block" }} aria-hidden>
                        {editingMsg ? "check" : "send"}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Room-life panel (desktop ≥1080px, CSS-gated) */}
          <aside className="lg-roomlife" style={{ width: panelW }}>
            <div
              className={`lg-roomlife-grip${panelDragging ? " active" : ""}`}
              onPointerDown={startPanelDrag}
              onDoubleClick={() => {
                setPanelW(232);
                localStorage.setItem("lg-roomlife-w", "232");
              }}
              title="Drag to resize. Double-click to reset"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the room-life panel"
            />
            <div>
              <PanelLabel color="var(--accent)">
                on the couch rn{voiceCount > 0 ? ` · ${voiceCount} live` : ""}
              </PanelLabel>
              {renderCouch(4, 36)}
            </div>
            {renderWaitingCard()}
          </aside>
        </div>
      )}

      {/* Mobile room-life sheet */}
      {sheetOpen && (
        <>
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(44,38,53,0.25)", zIndex: 60 }}
          />
          <div
            className="lg-room-sheet"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 61,
              background: "var(--card)",
              borderRadius: "26px 26px 0 0",
              boxShadow: "0 -12px 40px rgba(44,38,53,0.25)",
              padding: "10px 18px calc(22px + var(--safe-bottom))",
              maxHeight: "82vh",
              overflowY: "auto",
              animation: "lgSheetUp .28s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
            role="dialog"
            aria-label="Room life"
          >
            <span
              aria-hidden
              style={{
                display: "block",
                width: 44,
                height: 5,
                borderRadius: 999,
                background: "var(--border)",
                margin: "0 auto 12px",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <p className="lg-serif" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--text)" }}>
                room life
              </p>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {room.name}
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                style={{
                  marginLeft: "auto",
                  width: 44,
                  height: 44,
                  flex: "none",
                  padding: 0,
                  borderRadius: "50%",
                  background: "var(--bubble-soft)",
                  color: "var(--muted)",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <span className="msr" style={{ fontSize: 20 }} aria-hidden>
                  close
                </span>
              </button>
            </div>
            <PanelLabel color="var(--accent)">
              on the couch rn · {hereNow}
              {voiceCount > 0 ? ` · ${voiceCount} live` : ""}
            </PanelLabel>
            <div style={{ marginBottom: 12 }}>{renderCouch(5, 44)}</div>
            <button
              type="button"
              onClick={copyInvite}
              style={{
                width: "100%",
                padding: "12px 0",
                marginBottom: 12,
                borderRadius: 999,
                background: "var(--accent)",
                color: "#131316",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              💌 invite a girl
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {renderWaitingCard()}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap", fontSize: 13 }}>
              {room.rules && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    setShowRules(true);
                  }}
                  style={{ width: "auto", padding: 0, background: "transparent", border: "none", color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 13 }}
                >
                  room rules
                </button>
              )}
              {isCreator && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    setShowSettings(true);
                  }}
                  style={{ width: "auto", padding: 0, background: "transparent", border: "none", color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 13 }}
                >
                  settings{requests.length > 0 ? ` (${requests.length})` : ""}
                </button>
              )}
              {member && !isCreator && (
                <button
                  type="button"
                  onClick={leave}
                  style={{ width: "auto", padding: 0, background: "transparent", border: "none", color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 13 }}
                >
                  leave the room
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ConfettiLayer bursts={confetti} />
    </main>
  );
}
