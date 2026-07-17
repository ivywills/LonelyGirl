"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, isLight, uploadRoomImage, type Room } from "@/app/chat/rooms-client";

type Msg = {
  id: number;
  room_id: string;
  user_id: string;
  display_name: string;
  content: string;
  kind: "text" | "gif" | "system";
  pinned: boolean;
  created_at: string;
};

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

const GIF_RE = /^https?:\/\/\S+\.(gif|webp)(\?\S*)?$/i;
const isGif = (s: string) =>
  GIF_RE.test(s.trim()) || /^https?:\/\/(media\.|.*\b)(giphy|tenor)\.com\/\S+$/i.test(s.trim());

export default function RoomClient({
  room: initialRoom,
  userId,
  displayName,
  isMember: initiallyMember,
  myRequest: initialRequest,
  initialMessages,
}: {
  room: Room;
  userId: string;
  displayName: string;
  isMember: boolean;
  myRequest: JoinRequest | null;
  initialMessages: Msg[];
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
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [welcomeBanner, setWelcomeBanner] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [pinnedList, setPinnedList] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastSendRef = useRef(0);
  const isCreator = room.creator_id === userId;
  const light = isLight(room.bg_color);
  const ink = light ? "#262130" : "var(--text)";
  const sub = light ? "rgba(38,33,48,0.62)" : "var(--muted)";
  const acc = light ? "#6d4fc4" : "var(--accent)";

  useEffect(() => {
    // Only auto-scroll when the reader is already near the bottom
    if (stickRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
      .subscribe();
    return () => {
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
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
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
    });
    if (err) setError(err.message);
  }

  async function togglePin(m: Msg) {
    await supabase.from("messages").update({ pinned: !m.pinned }).eq("id", m.id);
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

  const pinned = pinnedList;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: room.bg_color,
        display: "flex",
        flexDirection: "column",
        maxWidth: 860,
        margin: "0 auto",
        padding: "18px 16px 16px",
        transition: "background .3s",
        color: ink,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link
          href="/chat"
          style={{ fontSize: 13, color: acc, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
            arrow_back
          </span>
          all rooms
        </Link>
        <h1 style={{ fontSize: 20 }}>
          {room.name}
          {room.is_private && (
            <span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>
              <span className="msr" style={{ fontSize: 13, marginRight: 2 }} aria-hidden>
                lock
              </span>
              PRIVATE
            </span>
          )}
        </h1>
        <span style={{ fontSize: 13, color: sub }}>{room.description}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {room.rules && (
            <button
              style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
              onClick={() => setShowRules((v) => !v)}
            >
              Rules
            </button>
          )}
          {isCreator && (
            <button
              style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
              onClick={() => setShowSettings((v) => !v)}
            >
              Settings{requests.length > 0 ? ` (${requests.length})` : ""}
            </button>
          )}
        </span>
      </header>

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

      {isCreator && showSettings && (
        <form onSubmit={saveSettings} className="card" style={{ maxWidth: "none", margin: "12px 0" }}>
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
                  background: c,
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
                  You're in — enter the room
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
                background: light ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.25)",
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
              if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            }}
            style={{
              flex: 1,
              overflowY: "auto",
              margin: "12px 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 300,
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
            {messages.map((m) =>
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
                    background: m.user_id === userId ? "var(--accent)" : "var(--card)",
                    color: m.user_id === userId ? "#131316" : "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    position: "relative",
                  }}
                >
                  <p style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{m.display_name}</p>
                  {m.kind === "gif" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.content} alt="gif" style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} />
                  ) : (
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
                  )}
                  {isCreator && (
                    <button
                      onClick={() => togglePin(m)}
                      aria-label={m.pinned ? "Unpin message" : "Pin message"}
                      title={m.pinned ? "Unpin" : "Pin"}
                      style={{
                        width: 22,
                        height: 22,
                        padding: 0,
                        position: "absolute",
                        bottom: -18,
                        left: -14,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.95)",
                        border: "1px solid rgba(0,0,0,0.25)",
                        color: m.pinned ? "#7c3aed" : "#8a8494",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                        push_pin
                      </span>
                    </button>
                  )}
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
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
          <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              style={{ width: "auto", padding: "0 14px" }}
              aria-label="Emoji picker"
            >
              <span className="msr" style={{ fontSize: 20 }} aria-hidden>
                mood
              </span>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something — or paste a GIF link to share it"
              style={{ marginBottom: 0 }}
            />
            <button
              className="primary"
              type="submit"
              aria-label="Send message"
              style={{ width: "auto", padding: "0 18px" }}
            >
              <span className="msr" style={{ fontSize: 20 }} aria-hidden>
                send
              </span>
            </button>
          </form>
        </>
      )}
    </main>
  );
}
