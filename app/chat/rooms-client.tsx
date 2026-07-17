"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Room = {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  bg_color: string;
  image_url: string;
  tags: string[];
  is_private: boolean;
  rules: string;
  welcome_message: string;
};

type JoinRequest = {
  id: string;
  room_id: string;
  note: string;
  status: string;
  chat_rooms: { name: string } | null;
};

export async function uploadRoomImage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  file: File
): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error } = await supabase.storage.from("room-images").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("room-images").getPublicUrl(path).data.publicUrl;
}

export const ROOM_COLORS = [
  "#fbd9e0",
  "#f6e0ee",
  "#e8def5",
  "#d9d3f2",
  "#d7e7f7",
  "#cfeef2",
  "#d3f0e4",
  "#e4f2d8",
  "#faf3d1",
  "#fbe6cf",
  "#f2dfd8",
  "#eceae4",
];

export function isLight(hex: string): boolean {
  try {
    const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 150;
  } catch {
    return false;
  }
}

export default function ChatDirectory({
  rooms,
  memberRoomIds,
  myRequests,
  userId,
  displayName,
}: {
  rooms: Room[];
  memberRoomIds: string[];
  myRequests: JoinRequest[];
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "joined" | "private">("all");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgColor, setBgColor] = useState(ROOM_COLORS[1]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [rules, setRules] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    rooms.forEach((r) => r.tags?.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [rooms]);

  const visible = rooms.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q));
    const matchesTag = !activeTag || r.tags?.includes(activeTag);
    const matchesScope =
      scope === "all" ||
      (scope === "joined" && memberRoomIds.includes(r.id)) ||
      (scope === "private" && r.is_private);
    return matchesQuery && matchesTag && matchesScope;
  });

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const tagList = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
    const { data, error: err } = await supabase
      .from("chat_rooms")
      .insert({
        creator_id: userId,
        name: name.trim(),
        description: description.trim(),
        tags: tagList,
        image_url: imageUrl.trim(),
        bg_color: bgColor,
        is_private: isPrivate,
        welcome_message: welcome.trim(),
        rules: rules.trim(),
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Could not create the room.");
      setBusy(false);
      return;
    }
    await supabase.from("room_members").insert({
      room_id: data.id,
      user_id: userId,
      display_name: displayName,
    });
    router.push(`/chat/${data.id}`);
  }

  const pending = myRequests.filter((r) => r.status === "pending");

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26 }}>Chatrooms</h1>
        <Link href="/" style={{ fontSize: 13 }}>
          back to the pile
        </Link>
        <button
          className="primary"
          style={{ width: "auto", marginLeft: "auto", padding: "8px 18px" }}
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Close" : "Create a room"}
        </button>
      </header>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>
        Find your people, or start a room of your own.
      </p>

      {creating && (
        <form
          onSubmit={createRoom}
          className={`card ${isLight(bgColor) ? "on-theme-light" : "on-theme"}`}
          style={{ maxWidth: "none", marginBottom: 24, background: bgColor, transition: "background .3s" }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>New room</h2>
          {error && <p className="msg-error">{error}</p>}
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="What is this room about?"
          />
          <label>Tags (comma separated — sports, gaming, a show...)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="anime, cozy, late-night" />
          <label>Room picture — rooms with one get way more visitors</label>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError("");
              try {
                setImageUrl(await uploadRoomImage(createClient(), userId, file));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed.");
              }
              setUploading(false);
            }}
            style={{ padding: 8 }}
          />
          {uploading && <p style={{ fontSize: 13, marginBottom: 12 }}>Uploading…</p>}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Room picture preview"
              style={{ height: 80, borderRadius: 10, marginBottom: 14, display: "block" }}
            />
          )}
          <label>Background colour</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBgColor(c)}
                aria-label={`Colour ${c}`}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: 8,
                  background: c,
                  border: c === bgColor ? "2px solid var(--accent)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>
          <label>Welcome message (sent to people when they join)</label>
          <input value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={200} />
          <label>Room rules (optional)</label>
          <input value={rules} onChange={(e) => setRules(e.target.value)} maxLength={500} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            Private — people must request to join
          </label>
          <button className="primary" disabled={busy || uploading} type="submit">
            {busy ? "Creating…" : uploading ? "Waiting for upload…" : "Create room"}
          </button>
        </form>
      )}

      {pending.length > 0 && (
        <section className="card" style={{ maxWidth: "none", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Waiting on</h2>
          {pending.map((r) => (
            <p key={r.id} style={{ fontSize: 14, color: "var(--muted)", margin: "6px 0" }}>
              <strong style={{ color: "var(--text)" }}>{r.chat_rooms?.name ?? "a room"}</strong>
              {r.note ? ` — your note: “${r.note}”` : ""}
            </p>
          ))}
        </section>
      )}

      <input
        placeholder="Search all rooms by title, tag or description..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {(
          [
            ["all", "All rooms"],
            ["joined", "Joined"],
            ["private", "Private"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setScope(key)}
            style={{
              width: "auto",
              padding: "4px 14px",
              fontSize: 13,
              borderRadius: 999,
              background: scope === key ? "var(--accent)" : "var(--card)",
              color: scope === key ? "#131316" : "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              style={{
                width: "auto",
                padding: "4px 12px",
                fontSize: 13,
                borderRadius: 999,
                background: activeTag === t ? "var(--accent)" : "var(--card)",
                color: activeTag === t ? "#131316" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {visible.map((r) => {
          const light = isLight(r.bg_color);
          const ink = light ? "#262130" : "var(--text)";
          const sub = light ? "rgba(38,33,48,0.62)" : "var(--muted)";
          const acc = light ? "#6d4fc4" : "var(--accent)";
          return (
            <Link
              key={r.id}
              href={`/chat/${r.id}`}
              style={{
                textDecoration: "none",
                color: ink,
                background: r.bg_color,
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
                display: "block",
              }}
            >
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt=""
                  style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    height: 44,
                    background: light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: sub,
                    fontSize: 12,
                  }}
                >
                  no picture yet
                </div>
              )}
              <div style={{ padding: "12px 14px 14px" }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>
                  {r.name}
                  {r.is_private && (
                    <span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>PRIVATE</span>
                  )}
                  {memberRoomIds.includes(r.id) && (
                    <span style={{ fontSize: 11, color: light ? "#2e7d4f" : "var(--success)", marginLeft: 8 }}>
                      JOINED
                    </span>
                  )}
                </p>
                {r.description && (
                  <p style={{ fontSize: 13, color: sub, margin: "4px 0 0" }}>{r.description}</p>
                )}
                {r.tags?.length > 0 && (
                  <p style={{ fontSize: 12, color: acc, margin: "8px 0 0" }}>
                    {r.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            No rooms match — start the first one.
          </p>
        )}
      </div>
    </main>
  );
}
