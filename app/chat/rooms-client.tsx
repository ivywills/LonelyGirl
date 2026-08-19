"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { previewText } from "@/lib/message-preview";
import PageHeader from "@/app/page-header";
import ChannelLounge, { type LoungeMember } from "@/app/chat/chat-lounge";
import { useChatMenu } from "@/app/chat/chat-shell";

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
  /** Which rail the room shows up in. Sectionless rooms fall into "More rooms". */
  section_id: string | null;
  /**
   * Set when an admin hides the room. RLS keeps hidden rooms out of every
   * non-admin query (supabase/room-archive.sql), so only admins ever receive
   * a row with this set — it lands in the Archive rail instead of the grid.
   */
  hidden_at?: string | null;
};

/** A rail on the directory — see supabase/room-sections.sql. */
export type Section = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  sort_order: number;
  /** Set when an admin archives the whole rail — see supabase/room-archive.sql. */
  hidden_at?: string | null;
};

/** Latest message in a room. Only readable for rooms you've joined (RLS). */
export type RoomActivity = {
  display_name: string;
  content: string;
  kind: string;
  created_at: string;
};

type JoinRequest = {
  id: string;
  room_id: string;
  note: string;
  status: string;
  chat_rooms: { name: string } | null;
};

/*
 * The mood chips map onto the free-form tags rooms already carry, so a chip is
 * a saved multi-tag filter rather than a second, parallel taxonomy. Each colour
 * is one of ROOM_COLORS, so roomSurface() gives the chip the pastel in light
 * mode and the deep tone in dark.
 */
export const MOODS: { label: string; icon: string; color: string; tags: string[] }[] = [
  { label: "anxious", icon: "waves", color: "#7c3aed", tags: ["anxiety", "anxious", "calm", "grounding", "panic"] },
  { label: "lonely", icon: "favorite", color: "#e11d48", tags: ["lonely", "loneliness", "connection", "friendship"] },
  { label: "burnt out", icon: "local_fire_department", color: "#ea580c", tags: ["burnout", "tired", "rest", "work"] },
  { label: "grieving", icon: "favorite_border", color: "#2563eb", tags: ["grief", "loss", "remembering", "bereavement"] },
  { label: "motivated", icon: "bolt", color: "#ca8a04", tags: ["motivation", "habits", "goals", "growth"] },
  { label: "new in town", icon: "explore", color: "#16a34a", tags: ["newintown", "toronto", "moving", "meet"] },
];

/** What each scope is called on screen — also what the filter button announces. */
const SCOPE_LABELS: Record<string, string> = {
  all: "all rooms",
  joined: "joined",
  discover: "not joined",
  public: "public",
  private: "private",
  waiting: "waiting",
};

/** Material Symbols offered when naming a new section. */
const SECTION_ICONS = [
  "volunteer_activism",
  "self_improvement",
  "directions_run",
  "palette",
  "forum",
  "favorite",
  "local_cafe",
  "nightlight",
  "diversity_1",
  "sunny",
];

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

/*
 * The room page's soft three-stop gradient: a lighter lift at the top, the
 * room colour through the middle, a slight warm shift at the bottom. The mix
 * targets are theme vars so it lifts toward white in light and depth in dark.
 */
function roomGradient(bg: string): string {
  return `linear-gradient(160deg, color-mix(in srgb, ${bg} 62%, var(--grad-hi)) 0%, ${bg} 58%, color-mix(in srgb, ${bg} 55%, var(--grad-tail)) 100%)`;
}

/*
 * Every colour in ROOM_COLORS has a dark and light display variant defined as
 * CSS vars in globals.css (--room-<hex>). roomSurface() resolves a stored hex
 * to theme-aware colours; unknown/legacy hexes fall back to fixed colours
 * chosen by brightness so they stay readable in either theme.
 */
export function roomSurface(hex: string) {
  const key = (hex ?? "").replace("#", "").toLowerCase();
  if (ROOM_COLORS.includes(`#${key}`)) {
    return {
      bg: `var(--room-${key})`,
      grad: roomGradient(`var(--room-${key})`),
      ink: "var(--room-ink)",
      sub: "var(--room-sub)",
      acc: "var(--room-acc)",
      tint: "var(--room-tint)",
      strip: "var(--room-strip)",
      success: "var(--room-success)",
      warn: "var(--room-warn)",
    };
  }
  if (!isLight(hex)) {
    // Legacy/custom dark colour: keep it in dark mode, auto-pastel it in light
    // mode by mixing toward white (see --room-mix in globals.css)
    const bg = `color-mix(in srgb, ${hex} var(--room-mix), var(--room-mix-on))`;
    return {
      bg,
      grad: roomGradient(bg),
      ink: "var(--room-ink)",
      sub: "var(--room-sub)",
      acc: "var(--room-acc)",
      tint: "var(--room-tint)",
      strip: "var(--room-strip)",
      success: "var(--room-success)",
      warn: "var(--room-warn)",
    };
  }
  // Rare light custom colour: fixed dark inks work in both themes
  return {
    bg: hex,
    grad: roomGradient(hex),
    ink: "#262130",
    sub: "rgba(38,33,48,0.62)",
    acc: "#6d4fc4",
    tint: "rgba(0,0,0,0.06)",
    strip: "rgba(255,255,255,0.5)",
    success: "#2e7d4f",
    warn: "#8a6d1a",
  };
}

/*
 * Person palette for chat avatars and name lines: pastel avatar chip with a
 * deep ink initial (readable in both themes), plus a theme-var name colour
 * (--pn-<i> in globals.css: deep in light mode, pastel in dark) and a soft
 * variant for reply-excerpt borders and voice-note waveforms.
 */
export const PERSON_COLORS = [
  { av: "#e4d9fb", avInk: "#5b3fb8", soft: "#cdbcff" },
  { av: "#d2efe9", avInk: "#0b6f66", soft: "#7fd4c6" },
  { av: "#f9dcea", avInk: "#a81d5b", soft: "#f3a8cd" },
  { av: "#f6ead0", avInk: "#8a6d1a", soft: "#eccf8d" },
  { av: "#d8e4fb", avInk: "#1e50c8", soft: "#a9c4f8" },
  { av: "#fbdae2", avInk: "#be123c", soft: "#f5a9bc" },
];

export function personTheme(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  const i = Math.abs(h) % PERSON_COLORS.length;
  return { ...PERSON_COLORS[i], name: `var(--pn-${i})` };
}

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

/*
 * The design's "38 online" needs presence tracking, which this app doesn't
 * have. This is the honest version of that line: the room's own last message,
 * which we can only see for rooms you've joined. Rooms with nothing recent
 * simply don't show a dot.
 */
function activityLabel(iso: string | undefined, now: number): string | null {
  if (!iso) return null;
  const mins = (now - new Date(iso).getTime()) / 60000;
  if (mins < 45) return "active now";
  if (mins < 60 * 24) return "active today";
  return null;
}

function previewOf(m: RoomActivity): string {
  return previewText(m, { verb: true });
}

function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function RoomCard({
  room,
  joined,
  pending,
  members,
  activity,
  now,
}: {
  room: Room;
  joined: boolean;
  pending: boolean;
  members: number;
  activity?: RoomActivity;
  now: number | null;
}) {
  const s = roomSurface(room.bg_color);
  // now is set after mount so the relative label can't mismatch on hydration
  const active = now ? activityLabel(activity?.created_at, now) : null;

  return (
    <Link href={`/chat/${room.id}`} className="lg-room-card">
      {room.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={room.image_url}
          alt=""
          style={{ width: "100%", height: 106, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            height: 106,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${s.bg} var(--room-soft-stripe), var(--card)) 0 16px, var(--card) 16px 32px)`,
          }}
        >
          <span
            style={{
              font: "600 9px ui-monospace, Menlo, monospace",
              letterSpacing: "0.12em",
              color: s.sub,
              background: s.strip,
              padding: "4px 9px",
              borderRadius: 999,
            }}
          >
            ROOM PHOTO
          </span>
        </div>
      )}
      <div style={{ padding: "13px 15px 15px" }}>
        <div
          className="lg-serif"
          style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.15, display: "flex", alignItems: "center", gap: 6 }}
        >
          {/* Two lines, then ellipsis — "Making Friends as an Adult" doesn't fit on one */}
          <span
            style={{
              minWidth: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {room.name}
          </span>
          {room.is_private && (
            <span className="msr" style={{ fontSize: 14, color: "var(--muted)" }} title="Private room" aria-label="Private room">
              lock
            </span>
          )}
        </div>
        {room.description && (
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            {room.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginTop: 11, flexWrap: "wrap" }}>
          {active && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--success)" }}>
              <span className="lg-online-dot" />
              {active}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            <span className="msr" style={{ fontSize: 13, marginRight: 2 }} aria-hidden>
              group
            </span>
            {compactCount(members)}
          </span>
          {joined && (
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--success)" }}>
              JOINED
            </span>
          )}
          {pending && (
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted)" }}>
              WAITING
            </span>
          )}
        </div>
        {activity ? (
          <div
            style={{
              marginTop: 11,
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
              fontSize: 11.5,
              color: "var(--muted)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activity.kind !== "system" && (
              <b style={{ color: "var(--accent)", fontWeight: 600 }}>{activity.display_name} </b>
            )}
            {previewOf(activity)}
          </div>
        ) : room.tags?.length > 0 ? (
          <div
            style={{
              marginTop: 11,
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
              fontSize: 11.5,
              color: "var(--accent)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {room.tags.map((t) => `#${t}`).join(" ")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

const ghostIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: "50%",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const textBtn: React.CSSProperties = {
  width: "auto",
  padding: 0,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 400,
};

export default function ChatDirectory({
  rooms: initialRooms,
  sections: initialSections,
  memberRoomIds,
  myRequests,
  userId,
  displayName,
  memberCounts = {},
  lastMessages = {},
  isAdmin = false,
  roomMembers = {},
}: {
  rooms: Room[];
  sections: Section[];
  memberRoomIds: string[];
  myRequests: JoinRequest[];
  userId: string;
  displayName: string;
  memberCounts?: Record<string, number>;
  lastMessages?: Record<string, RoomActivity>;
  /** Rooms and sections are created by admins only — see supabase/admins.sql. */
  isAdmin?: boolean;
  /** Member faces for the channel lounge — only populated when ≤3 rooms are live. */
  roomMembers?: Record<string, LoungeMember[]>;
}) {
  const router = useRouter();
  const onMenu = useChatMenu();

  // Server data, kept locally so section edits show up without a round trip
  const [rooms, setRooms] = useState(initialRooms);
  const [sections, setSections] = useState(initialSections);
  useEffect(() => setRooms(initialRooms), [initialRooms]);
  useEffect(() => setSections(initialSections), [initialSections]);

  const [query, setQuery] = useState("");
  // Admin escape hatch out of the channel lounge into the full directory
  const [showClassic, setShowClassic] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "discover" | "joined" | "public" | "private" | "waiting">("all");
  // Phone-only: whether the collapsed scope row is showing
  const [showScope, setShowScope] = useState(false);
  const [remote, setRemote] = useState<Room[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgColor, setBgColor] = useState(ROOM_COLORS[1]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [rules, setRules] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionSubtitle, setSectionSubtitle] = useState("");
  const [sectionIcon, setSectionIcon] = useState(SECTION_ICONS[0]);

  // Which rail is being renamed inline (admin), and its draft values
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");

  /*
   * Phone-only: which rail's ⋮ menu is open ("loose" for the sectionless
   * rail). On desktop the actions sit inline; on a phone they'd force the
   * rail title onto two lines, so they collapse behind one button.
   */
  const [railMenu, setRailMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!railMenu) return;
    // Attached after the opening click has finished bubbling, so any next
    // click — a menu item, another kebab, anywhere — closes the menu.
    const close = () => setRailMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [railMenu]);

  // Relative "active now" labels are time-dependent, so they wait for mount
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  /*
   * The full placeholder doesn't fit beside the Toronto badge on a phone.
   * Starts false so the server and the first client render agree, then
   * settles on mount — same 600px breakpoint the stylesheet uses.
   */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ⌘K / Ctrl-K jumps to the search box, as the hint chip promises
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const moodTags = useMemo(() => MOODS.find((m) => m.label === mood)?.tags ?? [], [mood]);

  // A feeling chip with zero matching rooms is a dead end — don't offer it.
  const shownMoods = useMemo(
    () =>
      MOODS.filter((m) =>
        rooms.some((r) => !r.hidden_at && r.tags?.some((t) => m.tags.includes(t.toLowerCase())))
      ),
    [rooms]
  );

  // Server-side search across ALL rooms (not just the first page loaded)
  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/[%_,()]/g, "");
    if (!q && moodTags.length === 0) {
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
      if (moodTags.length > 0) {
        const { data } = await sb.from("chat_rooms").select("*").overlaps("tags", moodTags).limit(60);
        found.push(...(data ?? []));
      }
      // Union of the queries; the filter below still ANDs the conditions
      const seen = new Set<string>();
      setRemote(found.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, moodTags]);

  const pendingRoomIds = myRequests.filter((r) => r.status === "pending").map((r) => r.room_id);

  /*
   * Server results widen the already-loaded list rather than replacing it, so
   * a slow, empty or failed search never blanks rooms that are right here.
   */
  const seenIds = new Set<string>();
  const base = remote
    ? [...rooms, ...remote].filter((r) => (seenIds.has(r.id) ? false : (seenIds.add(r.id), true)))
    : rooms;
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || !!mood || scope !== "all";

  // Hidden rooms never join the grid or search — admins manage them from the
  // Archive rail below instead. (Non-admins never receive them at all — RLS.)
  const archived = rooms.filter((r) => r.hidden_at);

  const visible = base.filter((r) => {
    if (r.hidden_at) return false;
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q));
    const matchesMood = !mood || r.tags?.some((t) => moodTags.includes(t.toLowerCase()));
    const matchesScope =
      scope === "all" ||
      (scope === "joined" && memberRoomIds.includes(r.id)) ||
      (scope === "discover" && !memberRoomIds.includes(r.id)) ||
      (scope === "public" && !r.is_private) ||
      (scope === "private" && r.is_private) ||
      (scope === "waiting" && pendingRoomIds.includes(r.id));
    return matchesQuery && matchesMood && matchesScope;
  });

  // One rail per section, in sort order, then everything sectionless.
  // Archived sections don't get a rail — they live in the Archive below.
  const liveSections = sections.filter((s) => !s.hidden_at);
  const grouped = new Map<string, Room[]>();
  const loose: Room[] = [];
  visible.forEach((r) => {
    if (r.section_id && liveSections.some((s) => s.id === r.section_id)) {
      grouped.set(r.section_id, [...(grouped.get(r.section_id) ?? []), r]);
    } else {
      loose.push(r);
    }
  });
  const rails: { section: Section | null; rooms: Room[] }[] = [
    ...[...liveSections]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((s) => ({ section: s, rooms: grouped.get(s.id) ?? [] })),
    ...(loose.length > 0 ? [{ section: null, rooms: loose }] : []),
  ];
  const shownRails = rails.filter((r) => r.rooms.length > 0 || (!filtering && isAdmin));
  const nothingMatches = visible.length === 0;

  function openCreate(forSection: string | null) {
    setSectionId(forSection ?? "");
    setCreating(true);
    setError("");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

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
        section_id: sectionId || null,
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

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionName.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const nextOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), 0) + 10;
    const { data, error: err } = await supabase
      .from("room_sections")
      .insert({
        name: sectionName.trim(),
        subtitle: sectionSubtitle.trim(),
        icon: sectionIcon,
        sort_order: nextOrder,
      })
      .select()
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? "Could not create that section.");
      return;
    }
    setSections((prev) => [...prev, data as Section]);
    setSectionName("");
    setSectionSubtitle("");
    setSectionIcon(SECTION_ICONS[0]);
    setAddingSection(false);
  }

  async function deleteSection(s: Section) {
    const count = rooms.filter((r) => r.section_id === s.id).length;
    const warning = count
      ? ` Its ${count} room${count === 1 ? "" : "s"} stay — ${count === 1 ? "it moves" : "they move"} down to "More rooms".`
      : "";
    if (!confirm(`Delete the "${s.name}" section?${warning}`)) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("room_sections").delete().eq("id", s.id);
    if (err) {
      setError(err.message);
      return;
    }
    // on delete set null in the database; mirror it locally so the rooms
    // reappear under "More rooms" straight away
    setSections((prev) => prev.filter((x) => x.id !== s.id));
    const unlink = (list: Room[]) => list.map((r) => (r.section_id === s.id ? { ...r, section_id: null } : r));
    setRooms(unlink);
    setRemote((prev) => (prev ? unlink(prev) : prev));
    if (sectionId === s.id) setSectionId("");
  }

  /*
   * Hide/restore is one nullable timestamp, so "bring it back" restores the
   * room exactly as it was — members, messages and settings untouched.
   */
  async function setHidden(r: Room, hidden: boolean) {
    if (
      hidden &&
      !confirm(`Hide "${r.name}"? It disappears for everyone except admins — you can bring it back from the archive at the bottom of this page.`)
    )
      return;
    setError("");
    const hiddenAt = hidden ? new Date().toISOString() : null;
    const supabase = createClient();
    const { error: err } = await supabase.from("chat_rooms").update({ hidden_at: hiddenAt }).eq("id", r.id);
    if (err) {
      setError(err.message);
      return;
    }
    const mark = (list: Room[]) => list.map((x) => (x.id === r.id ? { ...x, hidden_at: hiddenAt } : x));
    setRooms(mark);
    setRemote((prev) => (prev ? mark(prev) : prev));
  }

  /*
   * Archiving a rail stamps the SAME timestamp on the section and every
   * not-already-hidden room in it. Restoring only clears rooms carrying that
   * exact stamp, so a room hidden on its own beforehand stays hidden.
   */
  async function hideSection(s: Section) {
    const count = rooms.filter((r) => r.section_id === s.id && !r.hidden_at).length;
    if (
      !confirm(
        `Archive "${s.name}"${count ? ` and its ${count} room${count === 1 ? "" : "s"}` : ""}? It all disappears for everyone except admins — restore it from the archive at the bottom of this page.`
      )
    )
      return;
    setError("");
    const stamp = new Date().toISOString();
    const supabase = createClient();
    const { error: roomErr } = await supabase
      .from("chat_rooms")
      .update({ hidden_at: stamp })
      .eq("section_id", s.id)
      .is("hidden_at", null);
    if (roomErr) {
      setError(roomErr.message);
      return;
    }
    const { error: secErr } = await supabase.from("room_sections").update({ hidden_at: stamp }).eq("id", s.id);
    if (secErr) {
      setError(secErr.message);
      return;
    }
    const mark = (list: Room[]) =>
      list.map((x) => (x.section_id === s.id && !x.hidden_at ? { ...x, hidden_at: stamp } : x));
    setRooms(mark);
    setRemote((prev) => (prev ? mark(prev) : prev));
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, hidden_at: stamp } : x)));
  }

  async function restoreSection(s: Section) {
    if (!s.hidden_at) return;
    setError("");
    const supabase = createClient();
    const { error: roomErr } = await supabase
      .from("chat_rooms")
      .update({ hidden_at: null })
      .eq("section_id", s.id)
      .eq("hidden_at", s.hidden_at);
    if (roomErr) {
      setError(roomErr.message);
      return;
    }
    const { error: secErr } = await supabase.from("room_sections").update({ hidden_at: null }).eq("id", s.id);
    if (secErr) {
      setError(secErr.message);
      return;
    }
    const clear = (list: Room[]) =>
      list.map((x) => (x.section_id === s.id && x.hidden_at === s.hidden_at ? { ...x, hidden_at: null } : x));
    setRooms(clear);
    setRemote((prev) => (prev ? clear(prev) : prev));
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, hidden_at: null } : x)));
  }

  async function saveSectionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSection || !editName.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("room_sections")
      .update({ name: editName.trim(), subtitle: editSubtitle.trim() })
      .eq("id", editingSection);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSections((prev) =>
      prev.map((x) => (x.id === editingSection ? { ...x, name: editName.trim(), subtitle: editSubtitle.trim() } : x))
    );
    setEditingSection(null);
  }

  /*
   * A directory built for a dozen rooms makes two look like an outage. While
   * only a few are live, show the channel lounge instead — the directory
   * comes back on its own once more rooms are unhidden.
   */
  const liveRooms = rooms.filter((r) => !r.hidden_at);
  if (liveRooms.length > 0 && liveRooms.length <= 3 && !showClassic) {
    return (
      <ChannelLounge
        rooms={liveRooms}
        memberRoomIds={memberRoomIds}
        memberCounts={memberCounts}
        lastMessages={lastMessages}
        roomMembers={roomMembers}
        isAdmin={isAdmin}
        onManage={() => setShowClassic(true)}
        onMenu={onMenu}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Chatrooms"
        backHref="/"
        backLabel="change the channel"
        onMenu={onMenu}
      >
        {isAdmin && liveRooms.length <= 3 && (
          <button type="button" className="lg-cta lg-hide-narrow" onClick={() => setShowClassic(false)}>
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              live_tv
            </span>
            Live view
          </button>
        )}
        {/* Hidden on phones — admins still add rooms from the + on each rail */}
        {isAdmin && (
          <button type="button" className="lg-cta lg-hide-narrow" onClick={() => setCreating((v) => !v)}>
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              {creating ? "close" : "add_circle"}
            </span>
            {creating ? "Close" : "Create a room"}
          </button>
        )}
      </PageHeader>

      <main className="lg-page">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="lg-search">
            <span className="msr" style={{ fontSize: 21, color: "var(--accent)" }} aria-hidden>
              search
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder={narrow ? "Search rooms" : "Search rooms or a feeling…"}
              aria-label="Search rooms"
            />
            {query ? (
              <button type="button" className="lg-kbd" onClick={() => setQuery("")} title="Clear search">
                clear
              </button>
            ) : (
              <span className="lg-kbd">⌘K</span>
            )}
          </div>
          <span
            className="lg-loc-badge"
            title="every girl in every room here is right here in Toronto with you."
          >
            <span className="msr" style={{ fontSize: 16 }} aria-hidden>
              location_on
            </span>
            Toronto
          </span>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="lg-filter-head">
            <p className="lg-serif" style={{ fontSize: 13.5, fontStyle: "italic", color: "var(--muted)", margin: 0 }}>
              how are you feeling today?
            </p>
            {/* Phone-only: the scope row lives behind this until tapped */}
            <button
              type="button"
              className="lg-filter-btn"
              onClick={() => setShowScope((v) => !v)}
              aria-expanded={showScope}
              aria-label={scope === "all" ? "Filter rooms" : `Filter rooms — showing ${SCOPE_LABELS[scope] ?? scope}`}
              title="Filter rooms"
            >
              <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                tune
              </span>
              {scope !== "all" && <span className="lg-filter-dot" aria-hidden />}
            </button>
            <div className={`lg-scope-row${showScope ? " open" : ""}`}>
              {(
                [
                  ["all", SCOPE_LABELS.all],
                  ["joined", SCOPE_LABELS.joined],
                  ["discover", SCOPE_LABELS.discover],
                  ["private", SCOPE_LABELS.private],
                  ...(pendingRoomIds.length > 0
                    ? ([["waiting", `waiting (${pendingRoomIds.length})`]] as [typeof scope, string][])
                    : []),
                ] as [typeof scope, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setScope(key);
                    setShowScope(false);
                  }}
                  style={{
                    ...textBtn,
                    fontSize: 12.5,
                    fontWeight: scope === key ? 700 : 400,
                    color: scope === key ? "var(--accent)" : "var(--muted)",
                    textDecoration: scope === key ? "underline" : "none",
                    textUnderlineOffset: 3,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="lg-chip-row">
            {shownMoods.map((m) => {
              const s = roomSurface(m.color);
              const active = mood === m.label;
              return (
                <button
                  key={m.label}
                  type="button"
                  className="lg-mood-chip"
                  aria-pressed={active}
                  onClick={() => setMood(active ? null : m.label)}
                  style={{
                    background: `color-mix(in srgb, ${s.bg} var(--room-soft-chip), var(--card))`,
                    color: s.ink,
                  }}
                >
                  <span className="lg-mood-ic">
                    <span className="msr" style={{ fontSize: 14, color: s.acc }} aria-hidden>
                      {m.icon}
                    </span>
                  </span>
                  {m.label}
                </button>
              );
            })}
            {mood && (
              <button
                type="button"
                onClick={() => setMood(null)}
                style={{ ...textBtn, fontSize: 12.5, color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                clear
              </button>
            )}
          </div>
        </div>

        {error && <p className="msg-error" style={{ marginTop: 16 }}>{error}</p>}

        <div ref={formRef}>
          {creating && (
            <form
              onSubmit={createRoom}
              className="card on-room"
              style={{
                maxWidth: "none",
                margin: "22px 0 4px",
                background: roomSurface(bgColor).bg,
                transition: "background .3s",
              }}
            >
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>New room</h2>
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
              <label>Section (which rail it shows up in)</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--room-field-border)",
                  background: "var(--room-field-bg)",
                  color: "var(--room-ink)",
                  fontSize: 15,
                  marginBottom: 16,
                  fontFamily: "inherit",
                }}
              >
                <option value="">No section — show under “More rooms”</option>
                {[...liveSections]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              <label>Tags (comma separated — these are what the mood chips match)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="anxiety, calm, late-night" />
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
                      background: roomSurface(c).bg,
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

          {addingSection && (
            <form
              onSubmit={createSection}
              className="card"
              style={{ maxWidth: "none", margin: "22px 0 4px" }}
            >
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>New section</h2>
              <label>Title</label>
              <input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                maxLength={60}
                placeholder="A soft place to land"
                required
              />
              <label>Subtitle</label>
              <input
                value={sectionSubtitle}
                onChange={(e) => setSectionSubtitle(e.target.value)}
                maxLength={80}
                placeholder="support & mental health"
              />
              <label>Icon</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {SECTION_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setSectionIcon(ic)}
                    aria-label={ic}
                    aria-pressed={sectionIcon === ic}
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      borderRadius: 10,
                      background: "var(--bg)",
                      color: sectionIcon === ic ? "var(--accent)" : "var(--muted)",
                      border: sectionIcon === ic ? "2px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >
                    <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                      {ic}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="primary" type="submit" disabled={busy} style={{ width: "auto", padding: "8px 18px" }}>
                  {busy ? "Adding…" : "Add section"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingSection(false)}
                  style={{ width: "auto", padding: "8px 18px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {shownRails.map((rail, i) => {
          const s = rail.section;
          return (
            <section
              key={s?.id ?? "loose"}
              className="lg-rail"
              style={{ animationDelay: `${Math.min(i, 6) * 90}ms` }}
            >
              {s && editingSection === s.id ? (
                <form
                  onSubmit={saveSectionEdit}
                  style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 14px" }}
                >
                  <span className="msr" style={{ fontSize: 20, color: "var(--accent)" }} aria-hidden>
                    {s.icon}
                  </span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={60}
                    required
                    autoFocus
                    aria-label="Section title"
                    style={{ width: "auto", flex: "1 1 160px", marginBottom: 0 }}
                  />
                  <input
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    maxLength={80}
                    placeholder="subtitle"
                    aria-label="Section subtitle"
                    style={{ width: "auto", flex: "1 1 160px", marginBottom: 0 }}
                  />
                  <button className="primary" type="submit" disabled={busy} style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    style={{ width: "auto", padding: "8px 14px", fontSize: 13, background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span className="msr" style={{ fontSize: 20, color: "var(--accent)" }} aria-hidden>
                      {s?.icon ?? "grid_view"}
                    </span>
                    <h3 className="lg-serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
                      {s?.name ?? "More rooms"}
                    </h3>
                    {isAdmin && (() => {
                      const menuKey = s?.id ?? "loose";
                      const actions: { icon: string; label: string; run: () => void }[] = [
                        {
                          icon: "add",
                          label: s ? "Add a room" : "Add a room here",
                          run: () => openCreate(s?.id ?? null),
                        },
                        ...(s
                          ? [
                              {
                                icon: "edit",
                                label: "Rename",
                                run: () => {
                                  setEditingSection(s.id);
                                  setEditName(s.name);
                                  setEditSubtitle(s.subtitle);
                                },
                              },
                              { icon: "visibility_off", label: "Archive", run: () => hideSection(s) },
                              { icon: "delete", label: "Delete", run: () => deleteSection(s) },
                            ]
                          : []),
                      ];
                      return (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignSelf: "center", position: "relative" }}>
                          {/* One ⋮ at every width, so the rail title keeps its room */}
                          <button
                            type="button"
                            style={ghostIconBtn}
                            onClick={() => setRailMenu((v) => (v === menuKey ? null : menuKey))}
                            aria-expanded={railMenu === menuKey}
                            aria-label={s ? `Actions for ${s.name}` : "Actions for this rail"}
                          >
                            <span className="msr" style={{ fontSize: 17 }} aria-hidden>
                              more_vert
                            </span>
                          </button>
                          {railMenu === menuKey && (
                            <div
                              style={{
                                position: "absolute",
                                top: 34,
                                right: 0,
                                zIndex: 30,
                                display: "flex",
                                flexDirection: "column",
                                minWidth: 170,
                                padding: 6,
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                borderRadius: 12,
                                boxShadow: "0 14px 34px var(--lift)",
                              }}
                            >
                              {actions.map((a) => (
                                <button
                                  key={a.icon}
                                  type="button"
                                  onClick={a.run}
                                  style={{
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
                                  }}
                                >
                                  <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                                    {a.icon}
                                  </span>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  <p style={{ margin: "2px 0 14px 29px", fontSize: 13, color: "var(--muted)" }}>
                    {s ? s.subtitle : "everything else"}
                  </p>
                </>
              )}
              <div className="lg-rail-scroll">
                {rail.rooms.map((r) => {
                  const card = (
                    <RoomCard
                      key={isAdmin ? undefined : r.id}
                      room={r}
                      joined={memberRoomIds.includes(r.id)}
                      pending={pendingRoomIds.includes(r.id)}
                      members={memberCounts[r.id] ?? 0}
                      activity={lastMessages[r.id]}
                      now={now}
                    />
                  );
                  if (!isAdmin) return card;
                  // The button sits outside the card's Link so tapping it
                  // never navigates into the room.
                  return (
                    <div key={r.id} style={{ position: "relative", flex: "none" }}>
                      {card}
                      <button
                        type="button"
                        onClick={() => setHidden(r, true)}
                        title="Hide from users"
                        aria-label={`Hide ${r.name} from users`}
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          padding: 0,
                          borderRadius: "50%",
                          background: "rgba(19,19,22,.55)",
                          border: "none",
                          color: "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <span className="msr" style={{ fontSize: 15 }} aria-hidden>
                          visibility_off
                        </span>
                      </button>
                    </div>
                  );
                })}
                {rail.rooms.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--muted)", padding: "18px 2px" }}>
                    Nothing in here yet — use + to add the first room.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {nothingMatches && (
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 30 }}>
            {searching
              ? "Searching all rooms…"
              : filtering
                ? "No rooms match that — try another feeling, or clear the search."
                : "No rooms yet."}
          </p>
        )}

        {isAdmin && !addingSection && (
          <button
            type="button"
            onClick={() => {
              setAddingSection(true);
              setError("");
            }}
            style={{
              width: "auto",
              marginTop: 26,
              padding: "8px 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "var(--card)",
              color: "var(--muted)",
              border: "1px dashed var(--border)",
            }}
          >
            <span className="msr" style={{ fontSize: 17 }} aria-hidden>
              add
            </span>
            New section
          </button>
        )}

        {/* Admin-only archive: hidden rails and rooms, each one restore away. */}
        {isAdmin && (archived.length > 0 || sections.some((s) => s.hidden_at)) && (
          <section style={{ marginTop: 44 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span className="msr" style={{ fontSize: 20, color: "var(--muted)" }} aria-hidden>
                inventory_2
              </span>
              <h3 className="lg-serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
                Archive
              </h3>
            </div>
            <p style={{ margin: "2px 0 14px 29px", fontSize: 13, color: "var(--muted)" }}>
              hidden from everyone but admins — restore to put something back
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sections
                .filter((s) => s.hidden_at)
                .map((s) => {
                  const roomCount = rooms.filter((r) => r.section_id === s.id && r.hidden_at === s.hidden_at).length;
                  return (
                    <div
                      key={s.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: "1px solid var(--border)" }}
                    >
                      <span className="msr" style={{ fontSize: 17, color: "var(--muted)" }} aria-hidden>
                        {s.icon}
                      </span>
                      <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        section · {roomCount} room{roomCount === 1 ? "" : "s"}
                        {now && s.hidden_at ? ` · hidden ${new Date(s.hidden_at).toLocaleDateString()}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => restoreSection(s)}
                        style={{ ...textBtn, marginLeft: "auto", color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap" }}
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              {archived
                .filter((r) => {
                  // Rooms swept up in a section archive are covered by the
                  // section's own row above.
                  const sec = sections.find((s) => s.id === r.section_id);
                  return !(sec?.hidden_at && sec.hidden_at === r.hidden_at);
                })
                .map((r) => (
                  <div
                    key={r.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: "1px solid var(--border)" }}
                  >
                    <span
                      aria-hidden
                      style={{ width: 17, height: 17, borderRadius: 5, flex: "none", background: roomSurface(r.bg_color).bg }}
                    />
                    <Link
                      href={`/chat/${r.id}`}
                      style={{ fontSize: 14, color: "inherit", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {r.name}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {now && r.hidden_at ? `hidden ${new Date(r.hidden_at).toLocaleDateString()}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHidden(r, false)}
                      style={{ ...textBtn, marginLeft: "auto", color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap" }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
