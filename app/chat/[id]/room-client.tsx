"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROOM_COLORS, type Room } from "@/app/chat/rooms-client";

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

const EMOJIS = ["😀", "😂", "🥹", "😍", "😎", "🥲", "😤", "😭", "💀", "👀", "🔥", "✨", "💜", "🫶", "👍", "🎉", "📺", "🌙"];

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
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [welcomeBanner, setWelcomeBanner] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isCreator = room.creator_id === userId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!member) return;
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload: { new: Msg }) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload: { new: Msg }) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
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
    await supabase.from("messages").insert({
      room_id: room.id,
      user_id: userId,
      display_name: displayName,
      content: `${displayName} entered the room`,
      kind: "system",
    });
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setInput("");
    setShowEmoji(false);
    const { error: err } = await supabase.from("messages").insert({
      room_id: room.id,
      user_id: userId,
      display_name: displayName,
      content,
      kind: isGif(content) ? "gif" : "text",
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

  const pinned = messages.filter((m) => m.pinned);

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
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/chat" style={{ fontSize: 13 }}>
          ← all rooms
        </Link>
        <h1 style={{ fontSize: 20 }}>
          {room.name}
          {room.is_private && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>PRIVATE</span>
          )}
        </h1>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{room.description}</span>
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
        <p style={{ fontSize: 12, color: "var(--accent)", margin: "6px 0 0" }}>
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
          <input
            value={room.description}
            onChange={(e) => setRoom({ ...room, description: e.target.value })}
            maxLength={200}
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
          <label>Image URL</label>
          <input value={room.image_url} onChange={(e) => setRoom({ ...room, image_url: e.target.value })} />
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
                background: "rgba(0,0,0,0.25)",
              }}
            >
              {pinned.map((m) => (
                <p key={m.id} style={{ fontSize: 13, margin: "3px 0", color: "var(--accent)" }}>
                  PINNED — <strong>{m.display_name}:</strong> {m.content}
                </p>
              ))}
            </div>
          )}
          <div
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
            {messages.map((m) =>
              m.kind === "system" ? (
                <p key={m.id} style={{ textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
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
                      style={{
                        width: "auto",
                        padding: "1px 8px",
                        fontSize: 10,
                        position: "absolute",
                        top: -10,
                        right: 6,
                        borderRadius: 6,
                      }}
                    >
                      {m.pinned ? "unpin" : "pin"}
                    </button>
                  )}
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
          {showEmoji && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setInput((v) => v + em)}
                  style={{ width: "auto", padding: "4px 8px", fontSize: 18 }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              style={{ width: "auto", padding: "0 14px" }}
              aria-label="Emoji picker"
            >
              :)
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something — or paste a GIF link to share it"
              style={{ marginBottom: 0 }}
            />
            <button className="primary" type="submit" style={{ width: "auto", padding: "0 20px" }}>
              Send
            </button>
          </form>
        </>
      )}
    </main>
  );
}
