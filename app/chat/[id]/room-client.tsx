"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isNativeMobile } from "@/lib/runtime";
import { ImagePicker, ROOM_COLORS, roomSurface, uploadRoomImage, type Room } from "@/app/chat/rooms-client";
import { ProfileTrigger } from "@/app/profile-card";
import PageHeader from "@/app/page-header";
import { useChatMenu } from "@/app/chat/chat-shell";

/** Small pill buttons in the header bar (pop out, rules, settings, leave). */
const headerBtn: React.CSSProperties = {
  width: "auto",
  padding: "5px 12px",
  fontSize: 12,
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
};

/** Tiny inline report/delete icons in a bubble's meta row. */
const msgActionBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  marginLeft: 6,
  width: "auto",
  color: "inherit",
  opacity: 0.65,
  cursor: "pointer",
  verticalAlign: "middle",
};

type Msg = {
  id: number;
  room_id: string;
  user_id: string;
  display_name: string;
  content: string;
  kind: "text" | "gif" | "system" | "image";
  pinned: boolean;
  created_at: string;
  reply_to_id: number | null;
  edited_at: string | null;
};

type Reaction = { user_id: string; emoji: string };

/** The tapback row — small on purpose, the full picker is for composing. */
const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

type JoinRequest = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  note: string;
  status: string;
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

async function uploadCustomEmoji(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Custom emoji must be an image.");
  }
  if (file.size > 1024 * 1024) {
    throw new Error("That image is over 1MB — try a smaller one.");
  }
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error } = await supabase.storage.from("custom-emojis").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("custom-emojis").getPublicUrl(path).data.publicUrl;
}

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
  const onMenu = useChatMenu();
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
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState("");
  const [amBanned, setAmBanned] = useState(false);
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({});
  const [reactPickerFor, setReactPickerFor] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [showJump, setShowJump] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [attachBusy, setAttachBusy] = useState(false);
  // Set in an effect so server and first client render agree (hydration)
  const [onNative, setOnNative] = useState(false);
  useEffect(() => setOnNative(isNativeMobile()), []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickRef = useRef(true);
  const lastSendRef = useRef(0);
  const lastTypingRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isCreator = room.creator_id === userId;
  // Theme-aware room surface: known palette colours resolve to CSS vars with
  // dark and light display variants; legacy hexes get fixed readable inks
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

  useEffect(() => {
    if (!member) return;
    const channel = supabase
      .channel(`room-${room.id}`)
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
      .subscribe();
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
    else setReplyTo(null);
  }

  async function sendImage(file: File) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setAttachBusy(false);
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

  async function reportMessage(m: Msg) {
    const reason = window.prompt("What's wrong with this message? A sentence helps the admins act on it.");
    if (reason === null) return;
    const { error: err } = await supabase.from("reports").insert({
      reporter_id: userId,
      reported_user_id: m.user_id,
      message_id: m.id,
      message_content: m.content,
      room_id: room.id,
      reason: reason.trim().slice(0, 500),
    });
    if (err) setError(err.message);
    else setNotice("Report sent. An admin will take a look.");
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

  const pinned = pinnedList.filter((m) => !blockedIds.has(m.user_id));
  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id));

  return (
    <>
      <PageHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            {room.name}
            {room.is_private && (
              <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} title="Private room" aria-label="Private room">
                lock
              </span>
            )}
          </span>
        }
        backHref="/chat"
        backLabel="all rooms"
        onMenu={onMenu}
      >
        {/* Pop-out is a desktop/web affordance — a popup inside the phone WebView is a dead end */}
        {!onNative && (
          <button
            type="button"
            style={headerBtn}
            onClick={() =>
              window.open(window.location.pathname, "_blank", "popup=yes,width=980,height=760")
            }
            aria-label="Pop out chat"
            title="Pop out into its own window"
          >
            <span className="msr" style={{ fontSize: 16 }} aria-hidden>
              open_in_new
            </span>
          </button>
        )}
        {room.rules && (
          <button type="button" style={headerBtn} onClick={() => setShowRules((v) => !v)}>
            Rules
          </button>
        )}
        {isCreator && (
          <button type="button" style={headerBtn} onClick={() => setShowSettings((v) => !v)}>
            Settings{requests.length > 0 ? ` (${requests.length})` : ""}
          </button>
        )}
        {member && !isCreator && (
          <button type="button" style={headerBtn} onClick={leave} title="Leave this room">
            Leave
          </button>
        )}
      </PageHeader>
      <main
        className="lg-under-topbar lg-chat-lock"
        style={{
          background: surface.bg,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          padding: "18px 16px 16px",
          transition: "background .3s",
          color: ink,
        }}
      >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          position: "relative",
        }}
      >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        {room.description && <span style={{ fontSize: 13, color: sub }}>{room.description}</span>}
        <span style={{ fontSize: 12, color: sub, whiteSpace: "nowrap" }}>
          <span className="msr" style={{ fontSize: 13, marginRight: 3 }} aria-hidden>
            group
          </span>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      {room.tags?.length > 0 && (
        <p style={{ fontSize: 12, color: acc, margin: "6px 0 0" }}>
          {room.tags.map((t) => `#${t}`).join(" ")}
        </p>
      )}

      {showRules && room.rules && (
        <div className="card" style={{ maxWidth: "none", margin: "12px 0", padding: 16 }}>
          <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{room.rules}</p>
        </div>
      )}

      {error && <p className="msg-error" style={{ marginTop: 10 }}>{error}</p>}
      {notice && <p style={{ marginTop: 10, fontSize: 13, color: acc }}>{notice}</p>}

      {isCreator && showSettings && (
        <form
          onSubmit={saveSettings}
          className="card"
          // The page is height-locked for the sticky composer, so the long
          // settings form scrolls inside itself
          style={{ maxWidth: "none", margin: "12px 0", maxHeight: "58vh", overflowY: "auto" }}
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
          {requests.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: "6px 0 8px" }}>Waiting room</h3>
              {requests.map((r) => (
                <div
                  key={r.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13 }}
                >
                  <span style={{ flex: 1 }}>
                    <strong>{r.display_name}</strong>
                    {r.note ? ` — “${r.note}”` : ""}
                  </span>
                  <button
                    type="button"
                    style={{ width: "auto", padding: "4px 12px", fontSize: 12 }}
                    onClick={() => decide(r, true)}
                  >
                    Let in
                  </button>
                  <button
                    type="button"
                    style={{ width: "auto", padding: "4px 12px", fontSize: 12 }}
                    onClick={() => decide(r, false)}
                  >
                    Deny
                  </button>
                </div>
              ))}
            </>
          )}
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
                  You&apos;re in — enter the room
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
        <>
          {welcomeBanner && (
            <div
              className="card"
              style={{ maxWidth: "none", margin: "12px 0", padding: "10px 14px", borderColor: "var(--accent)" }}
            >
              <p style={{ fontSize: 14 }}>{welcomeBanner}</p>
            </div>
          )}
          {pinned.length > 0 && (
            <div
              style={{
                margin: "12px 0 0",
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: surface.strip,
              }}
            >
              {pinned.map((m) => (
                <p key={m.id} style={{ fontSize: 13, margin: "3px 0", color: acc }}>
                  <span className="msr" style={{ fontSize: 14, marginRight: 4 }} aria-hidden>
                    push_pin
                  </span>
                  <strong>{m.display_name}:</strong> {m.content}
                </p>
              ))}
            </div>
          )}
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
              margin: "12px 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 0,
            }}
          >
            {hasMore && (
              <button
                onClick={loadEarlier}
                style={{ width: "auto", alignSelf: "center", padding: "4px 16px", fontSize: 12 }}
              >
                Load earlier messages
              </button>
            )}
            {visibleMessages.map((m) =>
              m.kind === "system" ? (
                <p key={m.id} style={{ textAlign: "center", fontSize: 12, color: sub }}>
                  {m.content}
                </p>
              ) : (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.user_id === userId ? "flex-end" : "flex-start",
                    maxWidth: "78%",
                    // Own bubble stays fixed lavender in both themes — dark text on it
                    // always passes contrast, and it reads on any room colour
                    background: m.user_id === userId ? "#a78bfa" : "var(--card)",
                    color: m.user_id === userId ? "#131316" : "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    position: "relative",
                  }}
                >
                  <p style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>
                    {/* Own messages aren't tappable — you don't need a sheet about yourself. */}
                    {m.user_id === userId ? (
                      "You"
                    ) : (
                      <ProfileTrigger userId={m.user_id} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
                        {m.display_name}
                      </ProfileTrigger>
                    )}
                    <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.8 }}>{msgTime(m.created_at)}</span>
                    {m.edited_at && (
                      <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>(edited)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setReactPickerFor(reactPickerFor === m.id ? null : m.id)}
                      aria-label="React to this message"
                      title="React"
                      style={msgActionBtn}
                    >
                      <span className="msr" style={{ fontSize: 13 }} aria-hidden>
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
                      style={msgActionBtn}
                    >
                      <span className="msr" style={{ fontSize: 13 }} aria-hidden>
                        reply
                      </span>
                    </button>
                    {m.user_id === userId && m.kind === "text" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsg(m);
                          setReplyTo(null);
                          setInput(m.content);
                          inputRef.current?.focus();
                        }}
                        aria-label="Edit this message"
                        title="Edit"
                        style={msgActionBtn}
                      >
                        <span className="msr" style={{ fontSize: 13 }} aria-hidden>
                          edit
                        </span>
                      </button>
                    )}
                    {m.user_id !== userId && (
                      <button
                        type="button"
                        onClick={() => reportMessage(m)}
                        aria-label="Report this message"
                        title="Report"
                        style={msgActionBtn}
                      >
                        <span className="msr" style={{ fontSize: 13 }} aria-hidden>
                          flag
                        </span>
                      </button>
                    )}
                    {(m.user_id === userId || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(m)}
                        aria-label="Delete this message"
                        title="Delete"
                        style={msgActionBtn}
                      >
                        <span className="msr" style={{ fontSize: 13 }} aria-hidden>
                          delete
                        </span>
                      </button>
                    )}
                  </p>
                  {m.reply_to_id != null &&
                    (() => {
                      const orig = messages.find((x) => x.id === m.reply_to_id);
                      const excerpt = !orig
                        ? "Earlier message"
                        : orig.kind === "image"
                          ? "📷 Photo"
                          : orig.kind === "gif"
                            ? "GIF"
                            : orig.content.replace(CUSTOM_EMOJI_RE, "▪").slice(0, 80);
                      return (
                        <p
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            borderLeft: "2px solid currentColor",
                            padding: "1px 0 1px 8px",
                            margin: "0 0 5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {orig
                            ? `${orig.user_id === userId ? "You" : orig.display_name}: ${excerpt}`
                            : excerpt}
                        </p>
                      );
                    })()}
                  {m.kind === "gif" || m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.content}
                      alt={m.kind === "image" ? "photo" : "gif"}
                      style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
                    />
                  ) : (
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
                    </p>
                  )}
                  {(reactions[m.id]?.length ?? 0) > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {Object.entries(
                        (reactions[m.id] ?? []).reduce(
                          (acc, r) => {
                            acc[r.emoji] = acc[r.emoji] ?? { count: 0, mine: false };
                            acc[r.emoji].count += 1;
                            if (r.user_id === userId) acc[r.emoji].mine = true;
                            return acc;
                          },
                          {} as Record<string, { count: number; mine: boolean }>
                        )
                      ).map(([emoji, g]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(m, emoji)}
                          aria-label={`${g.count} ${emoji} reaction${g.count === 1 ? "" : "s"}${g.mine ? ", including yours" : ""}`}
                          style={{
                            width: "auto",
                            padding: "1px 8px",
                            fontSize: 12,
                            lineHeight: 1.6,
                            borderRadius: 999,
                            background: "transparent",
                            color: "inherit",
                            border: `1px solid ${g.mine ? "currentColor" : "var(--border)"}`,
                          }}
                        >
                          {emoji} {g.count}
                        </button>
                      ))}
                    </div>
                  )}
                  {reactPickerFor === m.id && (
                    <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
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
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            <div ref={bottomRef} />
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
                right: 10,
                bottom: 96,
                width: "auto",
                padding: newBelow > 0 ? "6px 14px" : "6px 9px",
                borderRadius: 999,
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                boxShadow: "0 3px 12px rgba(0,0,0,.28)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                zIndex: 5,
              }}
            >
              <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                arrow_downward
              </span>
              {newBelow > 0 ? `${newBelow} new` : null}
            </button>
          )}
          {showEmoji && (
            <div
              className="card"
              style={{ maxWidth: "none", marginBottom: 8, padding: 12, maxHeight: 240, overflowY: "auto" }}
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
          {amBanned ? (
            <p style={{ fontSize: 13, color: sub, textAlign: "center", padding: "10px 0" }}>
              Your account is banned from posting. If you think this is a mistake, reach out via
              the Support page.
            </p>
          ) : (
          <>
          <p style={{ fontSize: 11, color: sub, minHeight: 15, margin: "0 0 3px" }}>
            {(() => {
              const names = Object.values(typers)
                .filter((t) => t.until > Date.now())
                .map((t) => t.name);
              if (!names.length) return "";
              return `${names.join(", ")} ${names.length === 1 ? "is" : "are"} typing…`;
            })()}
          </p>
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
                  : `Replying to ${replyTo!.user_id === userId ? "yourself" : replyTo!.display_name}: ${
                      replyTo!.kind === "text"
                        ? replyTo!.content.replace(CUSTOM_EMOJI_RE, "▪").slice(0, 60)
                        : replyTo!.kind === "image"
                          ? "📷 Photo"
                          : "GIF"
                    }`}
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
          {/* Standard messenger composer: quiet round icon buttons, pill input, circular send */}
          <form onSubmit={send} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Emoji picker"
              title="Emoji"
              style={{
                width: 40,
                height: 40,
                flex: "none",
                padding: 0,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                color: acc,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="msr" style={{ fontSize: 22, lineHeight: 1, display: "block" }} aria-hidden>
                mood
              </span>
            </button>
            <input
              id="chat-photo-file"
              type="file"
              accept="image/*"
              disabled={attachBusy}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) sendImage(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="chat-photo-file"
              aria-label="Send a photo"
              title="Send a photo"
              style={{
                width: 40,
                height: 40,
                flex: "none",
                borderRadius: "50%",
                color: acc,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: attachBusy ? "wait" : "pointer",
              }}
            >
              <span className="msr" style={{ fontSize: 22, lineHeight: 1, display: "block" }} aria-hidden>
                {attachBusy ? "hourglass_top" : "image"}
              </span>
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                pingTyping();
              }}
              placeholder={editingMsg ? "Edit your message" : "Say something…"}
              style={{
                marginBottom: 0,
                borderRadius: 999,
                height: 40,
                padding: "0 16px",
                boxSizing: "border-box",
              }}
            />
            <button
              className="primary"
              type="submit"
              aria-label={editingMsg ? "Save edit" : "Send message"}
              title={editingMsg ? "Save" : "Send"}
              style={{
                width: 40,
                height: 40,
                flex: "none",
                padding: 0,
                borderRadius: "50%",
                marginLeft: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="msr" style={{ fontSize: 20, lineHeight: 1, display: "block" }} aria-hidden>
                {editingMsg ? "check" : "send"}
              </span>
            </button>
          </form>
          </>
          )}
        </>
      )}
      </div>
      </main>
    </>
  );
}
