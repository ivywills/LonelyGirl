"use client";

import { useEffect, useMemo, useState } from "react";
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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["heic", "heif"].includes(ext) || /hei[cf]/i.test(file.type)) {
    throw new Error(
      "iPhone HEIC photos can't be shown in most browsers — pick a JPG or PNG, or screenshot the photo and upload that."
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("That image is over 5MB — try a smaller one.");
  }
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error } = await supabase.storage.from("room-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("room-images").getPublicUrl(path).data.publicUrl;
}

export const ROOM_COLORS = [
  "#7c3aed",
  "#9333ea",
  "#4f46e5",
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#e11d48",
  "#db2777",
];

export function ImagePicker({
  id,
  imageUrl,
  uploading,
  onFile,
  title = "Add a room photo",
  hint = "Rooms with a picture get way more visitors — tap to choose one",
}: {
  id: string;
  imageUrl: string;
  uploading: boolean;
  onFile: (file: File) => void;
  title?: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <input
        id={id}
        type="file"
        accept="image/*"
        disabled={uploading}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        style={{
          display: "block",
          border: "2px dashed rgba(255,255,255,0.35)",
          borderRadius: 12,
          padding: imageUrl ? 8 : "20px 16px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: "rgba(0,0,0,0.15)",
        }}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Room picture"
              style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, display: "block" }}
            />
            <span style={{ fontSize: 12, display: "block", marginTop: 6 }}>
              {uploading ? "Uploading…" : "Looking good — tap to change it"}
            </span>
          </>
        ) : (
          <>
            <span className="msr" style={{ fontSize: 26, display: "block", marginBottom: 4 }} aria-hidden>
              add_a_photo
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>
              {uploading ? "Uploading…" : title}
            </span>
            <span style={{ fontSize: 12, display: "block", marginTop: 3, opacity: 0.75 }}>
              {hint}
            </span>
          </>
        )}
      </label>
    </div>
  );
}

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
  popularTags = [],
  memberCounts = {},
}: {
  rooms: Room[];
  memberRoomIds: string[];
  myRequests: JoinRequest[];
  userId: string;
  displayName: string;
  popularTags?: string[];
  memberCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [scope, setScope] = useState<"all" | "discover" | "joined" | "public" | "private" | "waiting">("all");
  const [remote, setRemote] = useState<Room[] | null>(null);
  const [searching, setSearching] = useState(false);
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

  // Popularity-ordered (popular_tags RPC first), then any extra tags from loaded rooms
  const allTags = useMemo(() => {
    const s = new Set<string>(popularTags);
    rooms.forEach((r) => r.tags?.forEach((t) => s.add(t)));
    return [...s];
  }, [rooms, popularTags]);

  // With hundreds of tags we only surface the top few until the user filters
  const visibleTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase().replace(/^#/, "");
    const matches = q ? allTags.filter((t) => t.includes(q)) : allTags;
    const shown = matches.slice(0, q ? 30 : 12);
    if (activeTag && !shown.includes(activeTag)) shown.unshift(activeTag);
    return shown;
  }, [allTags, tagQuery, activeTag]);

  // Server-side search across ALL rooms (not just the first page loaded)
  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/[%_,()]/g, "");
    if (!q && !activeTag) {
      setRemote(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const sb = createClient();
      const found: Room[] = [];
      if (q) {
        const [byText, byTag] = await Promise.all([
          sb
            .from("chat_rooms")
            .select("*")
            .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
            .order("created_at", { ascending: false })
            .limit(60),
          sb.from("chat_rooms").select("*").contains("tags", [q]).limit(60),
        ]);
        found.push(...(byText.data ?? []), ...(byTag.data ?? []));
      }
      if (activeTag) {
        const { data } = await sb.from("chat_rooms").select("*").contains("tags", [activeTag]).limit(60);
        found.push(...(data ?? []));
      }
      const seen = new Set<string>();
      setRemote(found.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeTag]);

  const pendingRoomIds = myRequests.filter((r) => r.status === "pending").map((r) => r.room_id);

  const base = remote ?? rooms;
  const visible = base.filter((r) => {
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
      (scope === "discover" && !memberRoomIds.includes(r.id)) ||
      (scope === "public" && !r.is_private) ||
      (scope === "private" && r.is_private) ||
      (scope === "waiting" && pendingRoomIds.includes(r.id));
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

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px", width: "100%" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26 }}>Chatrooms</h1>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            fontSize: 13,
            width: "auto",
            padding: 0,
            background: "transparent",
            border: "none",
            fontWeight: 400,
            color: "var(--accent)",
            cursor: "pointer",
          }}
        >
          change the channel
        </button>
        <button
          type="button"
          onClick={() => router.push("/events")}
          style={{
            fontSize: 13,
            width: "auto",
            padding: 0,
            background: "transparent",
            border: "none",
            fontWeight: 400,
            color: "var(--accent)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span className="msr" style={{ fontSize: 15 }} aria-hidden>
            event
          </span>
          events
        </button>
        <button
          className="primary"
          style={{
            width: "auto",
            marginLeft: "auto",
            padding: "8px 18px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          onClick={() => setCreating((v) => !v)}
        >
          <span className="msr" style={{ fontSize: 18 }} aria-hidden>
            {creating ? "close" : "add_circle"}
          </span>
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
          <label>Room picture</label>
          <ImagePicker
            id="create-room-image"
            imageUrl={imageUrl}
            uploading={uploading}
            onFile={async (file) => {
              setUploading(true);
              setError("");
              try {
                setImageUrl(await uploadRoomImage(createClient(), userId, file));
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

      <input
        placeholder="Search all rooms by title, tag or description..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {(
          [
            ["all", "All rooms"],
            ["discover", "Not joined"],
            ["joined", "Joined"],
            ["public", "Public"],
            ["private", "Private"],
            ...(pendingRoomIds.length > 0
              ? [["waiting", `Waiting (${pendingRoomIds.length})`]]
              : []),
          ] as [typeof scope, string][]
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
        <div
          style={{
            display: "flex",
            columnGap: 12,
            rowGap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <input
            placeholder="Filter tags..."
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            style={{
              width: 150,
              padding: "4px 10px",
              fontSize: 13,
              marginBottom: 0,
              borderRadius: 999,
            }}
          />
          {visibleTags.map((t) => {
            const active = activeTag === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTag(active ? null : t)}
                style={{
                  width: "auto",
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  color: active ? "var(--accent)" : "var(--muted)",
                  textDecoration: active ? "underline" : "none",
                  textUnderlineOffset: 3,
                }}
              >
                #{t}
              </button>
            );
          })}
          {visibleTags.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>no tags match</span>
          )}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              style={{
                width: "auto",
                padding: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--muted)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              clear
            </button>
          )}
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
                    <span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>
                      <span className="msr" style={{ fontSize: 12, marginRight: 2 }} aria-hidden>
                        lock
                      </span>
                      PRIVATE
                    </span>
                  )}
                  {memberRoomIds.includes(r.id) && (
                    <span style={{ fontSize: 11, color: light ? "#2e7d4f" : "var(--success)", marginLeft: 8 }}>
                      JOINED
                    </span>
                  )}
                  {pendingRoomIds.includes(r.id) && (
                    <span style={{ fontSize: 11, color: light ? "#8a6d1a" : "#fcd34d", marginLeft: 8 }}>
                      <span className="msr" style={{ fontSize: 12, marginRight: 2 }} aria-hidden>
                        hourglass_top
                      </span>
                      WAITING
                    </span>
                  )}
                </p>
                {r.description && (
                  <p style={{ fontSize: 13, color: sub, margin: "4px 0 0" }}>{r.description}</p>
                )}
                <p style={{ fontSize: 12, color: sub, margin: "6px 0 0" }}>
                  <span className="msr" style={{ fontSize: 13, marginRight: 3 }} aria-hidden>
                    group
                  </span>
                  {memberCounts[r.id] ?? 0} {(memberCounts[r.id] ?? 0) === 1 ? "member" : "members"}
                </p>
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
            {searching ? "Searching all rooms…" : "No rooms match — start the first one."}
          </p>
        )}
      </div>
    </main>
  );
}
