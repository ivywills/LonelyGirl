"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, roomSurface, uploadRoomImage } from "@/app/chat/rooms-client";
import { ProfileTrigger } from "@/app/profile-card";
import { colorForUserId, initialOf } from "@/lib/profile";
import { SERIF } from "@/lib/profile-theme";
import PageHeader from "@/app/page-header";

export type EventRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  starts_at: string;
  capacity: number | null;
  bg_color: string;
  image_url: string;
  /* Comfort fields — host-written reassurance for anyone arriving nervous. */
  arrival_note: string;
  quiet: boolean;
  first_timer: boolean;
};

type Attendee = { event_id: string; user_id: string; display_name: string };
type WaitRow = { event_id: string; user_id: string; created_at: string };
type ReactionCounts = Record<string, Record<string, number>>;

// Classic event categories, each with a Material Symbols icon
export const EVENT_CATEGORIES: [string, string][] = [
  ["live music", "music_note"],
  ["comedy", "theater_comedy"],
  ["film night", "movie"],
  ["book club", "menu_book"],
  ["workshop", "handyman"],
  ["art & craft", "palette"],
  ["food & drink", "restaurant"],
  ["games night", "sports_esports"],
  ["sports & fitness", "fitness_center"],
  ["dance", "nightlife"],
  ["wellness", "self_improvement"],
  ["talks", "record_voice_over"],
  ["market", "storefront"],
  ["meetup", "groups"],
  ["support circle", "diversity_3"],
];

const catIcon = (c: string) => EVENT_CATEGORIES.find(([name]) => name === c)?.[1] ?? "event";

// The hype meter's four moods: db kind, icon, label
const REACTIONS: [string, string, string][] = [
  ["love", "favorite", "love this"],
  ["so_in", "celebration", "so in"],
  ["hype", "local_fire_department", "hype"],
  ["nice", "mood", "sounds nice"],
];

/*
 * Deep per-colour accents for icons and day-strip dots — the dark-palette
 * variant of each room colour, dark enough to read on the pastel tiles.
 * The pastel itself comes from roomSurface(); these five differ from the
 * raw hex, the rest read fine as stored.
 */
const DEEP: Record<string, string> = {
  "#0891b2": "#0e7490",
  "#0d9488": "#0f766e",
  "#16a34a": "#15803d",
  "#ca8a04": "#a16207",
  "#ea580c": "#c2410c",
};
const deepOf = (hex: string) => DEEP[hex] ?? hex;

const BUTTER = "var(--butter)";
const inkBorder = (a: number) => `1px solid rgba(43, 39, 51, ${a})`;

/** Local-time day bucket, "YYYY-MM-DD" — the calendar's key for everything. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

// "tue 18 aug · 7:30 pm" — lowercase-cozy, like the rest of the page
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }).toLowerCase()} · ${fmtTime(iso)}`;
}

// "monday 17 august" — built by hand so the words stay lowercase in any locale
function dayName(d: Date): string {
  return `${d.toLocaleDateString([], { weekday: "long" }).toLowerCase()} ${d.getDate()} ${d
    .toLocaleDateString([], { month: "long" })
    .toLowerCase()}`;
}

function relOf(iso: string): string | null {
  const d = new Date(iso);
  const now = new Date();
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(d) - midnight(now)) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return `in ${diff} days`;
  return null;
}

function icsHref(e: EventRow): string {
  const dt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (s: string) => s.replace(/[\n\r]/g, " ").replace(/[,;\\]/g, " ");
  const start = new Date(e.starts_at);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LonelyGirl//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@lonelygirl`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    `SUMMARY:${clean(e.title)}`,
    e.location ? `LOCATION:${clean(e.location)}` : "",
    e.description ? `DESCRIPTION:${clean(e.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(body);
}

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
const placeLabel = (s: string) => (isUrl(s) ? s.trim().replace(/^https?:\/\//i, "").slice(0, 40) : s);

/** ISO → the local "YYYY-MM-DDTHH:mm" a datetime-local input wants. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Quick-action chip: white at rest, butter when the toggle is on. */
function Chip({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 999,
        background: active ? BUTTER : "var(--card)",
        color: "var(--text)",
        border: active ? inkBorder(0.25) : "1px solid var(--border)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span className="msr" style={{ fontSize: 15 }} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

/*
 * The community's one rule, said as reassurance rather than policy. Everyone
 * arrives on their own, so there is never an established group to break into.
 */
const ALONE_LINES = [
  "Showing up alone can be scary, but you won't be the only one.",
  "You don't have to say anything at quiet events, you can just observe.",
  "I will be at good first events to ensure that everyone feels welcome.",
];

/*
 * Decoration, not information: line 1 renders on the server and the rotation
 * only starts after mount, so there is nothing to mismatch on hydration and
 * reduced-motion simply holds on the first line.
 */
function AloneRule() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ALONE_LINES.length), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <p style={{ margin: "-4px 4px 16px", fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
      <span style={{ fontFamily: SERIF, fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
        You&apos;ll walk in alone. So will everyone else. No plus-ones, no groups, there&apos;s
        never a circle to break into.
      </span>
      <span style={{ display: "block", marginTop: 3 }}>{ALONE_LINES[idx]}</span>
    </p>
  );
}

/*
 * Comfort badges. Read-only for guests; only the admin form writes them.
 * `quiet` promises talking is optional, `first_timer` marks an easy first one.
 */
const COMFORT: { key: "quiet" | "first_timer"; icon: string; short: string; long: string; hint: string }[] = [
  { key: "quiet", icon: "volume_off", short: "quiet", long: "quiet, talking optional", hint: "talking optional" },
  {
    key: "first_timer",
    icon: "waving_hand",
    short: "good first event",
    long: "good first event",
    hint: "an easy one to start with",
  },
];

/** Comfort badge. `size` "row" is the agenda line, "detail" the pop-up banner. */
function ComfortBadge({
  icon,
  label,
  hint,
  size,
  butter,
}: {
  icon: string;
  label: string;
  hint: string;
  size: "row" | "detail";
  butter?: boolean;
}) {
  const detail = size === "detail";
  return (
    <span
      title={hint}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        padding: detail ? "2px 10px" : "1px 8px 2px",
        fontSize: detail ? 11 : 10,
        fontWeight: 700,
        background: butter ? BUTTER : "var(--card)",
        color: butter ? "#2b2733" : detail ? "#2c2635" : "var(--muted)",
        border: inkBorder(0.16),
        whiteSpace: "nowrap",
      }}
    >
      <span className="msr" style={{ fontSize: detail ? 13 : 12 }} aria-hidden>
        {icon}
      </span>
      {label}
    </span>
  );
}

export default function EventsClient({
  events,
  initialAttendees,
  initialWaitlist,
  initialReactionCounts,
  initialMyReactions,
  initialSaves,
  initialReminders,
  userId,
  displayName,
  isAdmin = false,
}: {
  events: EventRow[];
  initialAttendees: Attendee[];
  initialWaitlist: WaitRow[];
  initialReactionCounts: ReactionCounts;
  /** `${event_id}:${kind}` keys, only ever the viewer's own. */
  initialMyReactions: string[];
  initialSaves: string[];
  initialReminders: string[];
  // null when signed out: the page is public to read, so every write path
  // below bails to /login and the UI offers sign-in instead of the action.
  userId: string | null;
  displayName: string;
  /** Hosting is admin-only — RLS in supabase/events-admin.sql is the rule. */
  isAdmin?: boolean;
}) {
  const [localEvents, setLocalEvents] = useState<EventRow[]>(events);
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);
  const [waitlist, setWaitlist] = useState<WaitRow[]>(initialWaitlist);
  const [reactCounts, setReactCounts] = useState<ReactionCounts>(initialReactionCounts);
  const [myReacts, setMyReacts] = useState<Set<string>>(() => new Set(initialMyReactions));
  const [saves, setSaves] = useState<Set<string>>(() => new Set(initialSaves));
  const [reminders, setReminders] = useState<Set<string>>(() => new Set(initialReminders));

  const [view, setView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"upcoming" | "booked" | "saved" | "past">("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(EVENT_CATEGORIES[0][0]);
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgColor, setBgColor] = useState(ROOM_COLORS[11]);
  const [arrivalNote, setArrivalNote] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [firstTimer, setFirstTimer] = useState(false);
  // When set, the form above edits this event instead of creating a new one
  const [editingId, setEditingId] = useState<string | null>(null);

  // Share links land here as /events#<event-id> — open that event's card
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && events.some((e) => e.id === id)) setOpenId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const signIn = () => {
    window.location.href = "/login?next=/events";
  };

  /** Everything the row and the pop-up need to know about one event. */
  function stat(e: EventRow) {
    const att = attendees.filter((a) => a.event_id === e.id);
    const going = att.length;
    const booked = userId ? att.some((a) => a.user_id === userId) : false;
    const full = e.capacity != null && going >= e.capacity;
    const isPast = new Date(e.starts_at).getTime() < Date.now();
    const wl = waitlist
      .filter((w) => w.event_id === e.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pos = userId ? wl.findIndex((w) => w.user_id === userId) : -1;
    return {
      att,
      going,
      booked,
      full,
      isPast,
      hosting: !!userId && e.creator_id === userId,
      wl,
      onWl: pos >= 0,
      pos,
      spotsLeft: e.capacity != null ? Math.max(0, e.capacity - going) : null,
    };
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory(EVENT_CATEGORIES[0][0]);
    setLocation("");
    setStartsAt("");
    setCapacity("");
    setImageUrl("");
    setBgColor(ROOM_COLORS[11]);
    setArrivalNote("");
    setQuiet(false);
    setFirstTimer(false);
  }

  function openEdit(e: EventRow) {
    setEditingId(e.id);
    setTitle(e.title);
    setDescription(e.description);
    setCategory(e.category);
    setLocation(e.location);
    setStartsAt(toLocalInput(e.starts_at));
    setCapacity(e.capacity ? String(e.capacity) : "");
    setImageUrl(e.image_url);
    setBgColor(e.bg_color);
    setArrivalNote(e.arrival_note ?? "");
    setQuiet(!!e.quiet);
    setFirstTimer(!!e.first_timer);
    setCreating(true);
    setError("");
    setOpenId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function book(e: EventRow) {
    if (!userId) return signIn();
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_attendees")
      .insert({ event_id: e.id, user_id: userId, display_name: displayName });
    if (err) setError(err.message);
    else
      setAttendees((prev) => [
        ...prev,
        { event_id: e.id, user_id: userId, display_name: displayName },
      ]);
  }

  async function cancelBook(e: EventRow) {
    if (!userId) return;
    setError("");
    const st = stat(e);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", e.id)
      .eq("user_id", userId);
    if (err) {
      setError(err.message);
      return;
    }
    /*
     * Mirror the database trigger (supabase/events-redesign.sql): my spot
     * frees up, so the first person in line is promoted. Their display name
     * isn't in the waitlist row — they render anonymously until next load.
     */
    const next =
      e.capacity != null && st.wl.length > 0 && st.going - 1 < e.capacity
        ? st.wl.find((w) => w.user_id !== userId)
        : undefined;
    setAttendees((prev) => {
      const rest = prev.filter((a) => !(a.event_id === e.id && a.user_id === userId));
      return next
        ? [...rest, { event_id: e.id, user_id: next.user_id, display_name: "" }]
        : rest;
    });
    if (next) {
      setWaitlist((prev) =>
        prev.filter((w) => !(w.event_id === e.id && w.user_id === next.user_id))
      );
    }
  }

  async function joinWait(e: EventRow) {
    if (!userId) return signIn();
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_waitlist")
      .insert({ event_id: e.id, user_id: userId });
    if (err) setError(err.message);
    else
      setWaitlist((prev) => [
        ...prev,
        { event_id: e.id, user_id: userId, created_at: new Date().toISOString() },
      ]);
  }

  async function leaveWait(e: EventRow) {
    if (!userId) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_waitlist")
      .delete()
      .eq("event_id", e.id)
      .eq("user_id", userId);
    if (err) setError(err.message);
    else
      setWaitlist((prev) => prev.filter((w) => !(w.event_id === e.id && w.user_id === userId)));
  }

  async function toggleSave(id: string) {
    if (!userId) return signIn();
    const on = saves.has(id);
    setSaves((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
    const supabase = createClient();
    const { error: err } = on
      ? await supabase.from("event_saves").delete().eq("event_id", id).eq("user_id", userId)
      : await supabase.from("event_saves").insert({ event_id: id, user_id: userId });
    if (err) setError(err.message);
  }

  async function toggleReminder(id: string) {
    if (!userId) return signIn();
    const on = reminders.has(id);
    setReminders((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
    const supabase = createClient();
    const { error: err } = on
      ? await supabase.from("event_reminders").delete().eq("event_id", id).eq("user_id", userId)
      : await supabase.from("event_reminders").insert({ event_id: id, user_id: userId });
    if (err) setError(err.message);
  }


  async function toggleReact(id: string, kind: string) {
    if (!userId) return signIn();
    const key = `${id}:${kind}`;
    const on = myReacts.has(key);
    setMyReacts((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });
    setReactCounts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [kind]: Math.max(0, (prev[id]?.[kind] ?? 0) + (on ? -1 : 1)) },
    }));
    const supabase = createClient();
    const { error: err } = on
      ? await supabase
          .from("event_reactions")
          .delete()
          .eq("event_id", id)
          .eq("user_id", userId)
          .eq("kind", kind)
      : await supabase.from("event_reactions").insert({ event_id: id, user_id: userId, kind });
    if (err) setError(err.message);
  }

  function copyLink(id: string) {
    try {
      navigator.clipboard.writeText(`${window.location.origin}/events#${id}`);
    } catch {
      // Clipboard can be unavailable in the shells; the flip still confirms intent
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  async function deleteEvent(e: EventRow) {
    if (!userId) return;
    if (!confirm(`Delete "${e.title}"? Everyone's bookings go with it.`)) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("events").delete().eq("id", e.id);
    if (err) setError(err.message);
    else {
      setLocalEvents((prev) => prev.filter((x) => x.id !== e.id));
      setAttendees((prev) => prev.filter((a) => a.event_id !== e.id));
      setWaitlist((prev) => prev.filter((w) => w.event_id !== e.id));
      setOpenId(null);
    }
  }

  async function saveEvent(ev: React.FormEvent) {
    ev.preventDefault();
    if (!userId) return;
    if (!title.trim() || !startsAt) {
      setError("a title and a date are required.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const cap = parseInt(capacity, 10);
    const fields = {
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      starts_at: new Date(startsAt).toISOString(),
      capacity: Number.isFinite(cap) && cap > 0 ? cap : null,
      bg_color: bgColor,
      image_url: imageUrl.trim(),
      arrival_note: arrivalNote.trim(),
      quiet,
      first_timer: firstTimer,
    };

    if (editingId) {
      const { data, error: err } = await supabase
        .from("events")
        .update(fields)
        .eq("id", editingId)
        .select()
        .single();
      setBusy(false);
      if (err || !data) {
        setError(err?.message ?? "Could not save the event.");
        return;
      }
      setLocalEvents((prev) =>
        prev
          .map((x) => (x.id === editingId ? (data as EventRow) : x))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      );
      setCreating(false);
      resetForm();
      return;
    }

    const { data, error: err } = await supabase
      .from("events")
      .insert({ creator_id: userId, ...fields })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Could not create the event.");
      setBusy(false);
      return;
    }
    // The host has a spot at their own event
    await supabase
      .from("event_attendees")
      .insert({ event_id: data.id, user_id: userId, display_name: displayName });
    setLocalEvents((prev) => [...prev, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setAttendees((prev) => [
      ...prev,
      { event_id: data.id, user_id: userId, display_name: displayName },
    ]);
    setCreating(false);
    setBusy(false);
    resetForm();
  }

  // ---- Calendar bookkeeping ------------------------------------------------

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    localEvents.forEach((e) => {
      const k = dayKey(new Date(e.starts_at));
      map.set(k, [...(map.get(k) ?? []), e]);
    });
    map.forEach((list) => list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    return map;
  }, [localEvents]);

  const now = new Date();
  const todayKey = dayKey(now);
  const stripStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7);
  const stripDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(stripStart.getFullYear(), stripStart.getMonth(), stripStart.getDate() + i);
    return { d, k: dayKey(d) };
  });
  // Week view's header month is the strip's middle day; month view's, the shown month
  const stripMid = new Date(stripStart.getFullYear(), stripStart.getMonth(), stripStart.getDate() + 7);
  const headerMonth = view === "month" ? calMonth : stripMid;
  const monthLabel = headerMonth
    .toLocaleDateString([], { month: "long", year: "numeric" })
    .toLowerCase();

  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth();
  const monthCount = localEvents.filter((e) => {
    const d = new Date(e.starts_at);
    return d.getFullYear() === calYear && d.getMonth() === calMon;
  }).length;

  // ---- Agenda --------------------------------------------------------------

  const q = query.trim().toLowerCase();
  const visible = localEvents
    .filter((e) => {
      const st = stat(e);
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.category.includes(q);
      const d = new Date(e.starts_at);
      const inMonth =
        view !== "month" || (d.getFullYear() === calYear && d.getMonth() === calMon);
      const matchesDay = selectedDay ? dayKey(d) === selectedDay : inMonth;
      const matchesScope =
        (scope === "upcoming" && !st.isPast) ||
        (scope === "booked" && (st.booked || st.onWl)) ||
        (scope === "saved" && saves.has(e.id)) ||
        (scope === "past" && st.isPast);
      return matchesQuery && matchesDay && matchesScope;
    })
    .sort((a, b) =>
      scope === "past" ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at)
    );

  const sections: { k: string; rows: EventRow[] }[] = [];
  {
    const seen = new Map<string, EventRow[]>();
    visible.forEach((e) => {
      const k = dayKey(new Date(e.starts_at));
      if (!seen.has(k)) {
        seen.set(k, []);
        sections.push({ k, rows: seen.get(k)! });
      }
      seen.get(k)!.push(e);
    });
  }

  const emptyLine = (() => {
    if (selectedDay && sections.length === 0)
      return `nothing on ${dayName(new Date(`${selectedDay}T12:00`))}. a rest day.`;
    if (view === "month" && sections.length === 0)
      return `nothing in ${calMonth.toLocaleDateString([], { month: "long" }).toLowerCase()}. flip ahead.`;
    return {
      upcoming: "nothing coming up. check back soon.",
      booked: "no plans yet, that's what this page is for.",
      saved: "nothing saved yet. tap the bookmark on anything tempting.",
      past: "no past events yet.",
    }[scope];
  })();

  const open = openId ? localEvents.find((e) => e.id === openId) : undefined;

  // ---- Building blocks -----------------------------------------------------

  const circleBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: "50%",
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 14.5,
    marginBottom: 14,
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 5,
  };

  function rowCta(e: EventRow, st: ReturnType<typeof stat>) {
    const pill = (
      label: string,
      opts: {
        icon?: string;
        bg: string;
        color: string;
        border: string;
        onClick: () => void;
      }
    ) => (
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          opts.onClick();
        }}
        style={{
          width: "auto",
          flex: "none",
          padding: "7px 13px",
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 999,
          background: opts.bg,
          color: opts.color,
          border: opts.border,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          whiteSpace: "nowrap",
        }}
      >
        {opts.icon && (
          <span className="msr" style={{ fontSize: 14 }} aria-hidden>
            {opts.icon}
          </span>
        )}
        {label}
      </button>
    );
    if (!userId)
      return pill("sign in", {
        bg: "var(--accent)",
        color: "#131316",
        border: "none",
        onClick: signIn,
      });
    if (st.hosting)
      return pill("hosting", {
        icon: "diversity_3",
        bg: BUTTER,
        color: "var(--text)",
        border: inkBorder(0.18),
        onClick: () => setOpenId(e.id),
      });
    if (st.booked)
      return pill("going", {
        icon: "check",
        bg: "var(--card)",
        color: "var(--text)",
        border: inkBorder(0.22),
        onClick: () => setOpenId(e.id),
      });
    if (st.full && st.onWl)
      return pill("on the list", {
        icon: "hourglass_top",
        bg: "var(--card)",
        color: "var(--muted)",
        border: "1px solid var(--border)",
        onClick: () => setOpenId(e.id),
      });
    if (st.full)
      return pill("waitlist", {
        bg: BUTTER,
        color: "var(--text)",
        border: inkBorder(0.18),
        onClick: () => joinWait(e),
      });
    return pill("book", {
      bg: "var(--accent)",
      color: "#131316",
      border: "none",
      onClick: () => book(e),
    });
  }

  // ---- Render --------------------------------------------------------------

  return (
    <>
      <PageHeader
        title={
          <>
            Events
            <span
              className="lg-hide-narrow"
              style={{
                fontFamily: SERIF,
                fontSize: 15,
                fontWeight: 400,
                color: "var(--muted)",
                marginLeft: 12,
              }}
            >
              your week, penciled in
            </span>
          </>
        }
        backHref="/"
        backLabel="change the channel"
      >
        {/* Hidden on phones, like the chat directory's create button.
            Hosting is admin-only, so everyone else gets no CTA at all. */}
        {isAdmin && (
          <button
            type="button"
            className="lg-cta lg-hide-narrow"
            style={{ borderRadius: 999, padding: "9px 18px", fontSize: 13.5, fontWeight: 700 }}
            onClick={() => {
              if (creating) resetForm();
              setCreating((v) => !v);
            }}
          >
            <span className="msr" style={{ fontSize: 17 }} aria-hidden>
              {creating ? "close" : "add_circle"}
            </span>
            {creating ? "close" : "host an event"}
          </button>
        )}
      </PageHeader>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 70px", width: "100%", boxSizing: "border-box" }}>
        {error && (
          <p style={{ color: "var(--error)", fontSize: 13.5, margin: "0 0 14px" }}>{error}</p>
        )}

        {creating && isAdmin && (
          <form
            onSubmit={saveEvent}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: 20,
              boxShadow: "0 10px 26px var(--lift-soft)",
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 21, margin: 0 }}>
                {editingId ? "edit event" : "new event"}
              </h2>
              <span
                style={{
                  background: BUTTER,
                  border: inkBorder(0.16),
                  borderRadius: 999,
                  padding: "1px 9px 2px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  transform: "rotate(-2deg)",
                }}
              >
                admins only
              </span>
            </div>
            <label style={labelStyle}>title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Give it a name people can picture"
              style={fieldStyle}
            />
            <label style={labelStyle}>what&apos;s happening?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="A line or two, keep it warm"
              style={{ ...fieldStyle, resize: "vertical" }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0 14px",
              }}
            >
              <div>
                <label style={labelStyle}>category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={fieldStyle}
                >
                  {EVENT_CATEGORIES.map(([name]) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>when</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>where</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={120}
                  placeholder="A place, a park, a link..."
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>spots (empty = unlimited)</label>
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="unlimited"
                  style={fieldStyle}
                />
              </div>
            </div>

            {/*
             * Scripts the scary first minute. Optional, but an event without
             * one loses the arrival box in the pop-up, so prompt for it.
             */}
            <label style={labelStyle}>how will they find you?</label>
            <input
              value={arrivalNote}
              onChange={(e) => setArrivalNote(e.target.value)}
              maxLength={140}
              placeholder="Script the scary first minute, e.g. look for the yellow tote by the window, I'll wave you over"
              style={fieldStyle}
            />

            <label style={labelStyle}>comfort level</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Chip
                active={quiet}
                icon="volume_off"
                label="quiet, talking optional"
                onClick={() => setQuiet((v) => !v)}
              />
              <Chip
                active={firstTimer}
                icon="waving_hand"
                label="good first event"
                onClick={() => setFirstTimer((v) => !v)}
              />
            </div>

            <label style={labelStyle}>event photo</label>
            <ImagePicker
              id="create-event-image"
              imageUrl={imageUrl}
              uploading={uploading}
              title="add an event photo"
              hint="events with a picture get way more bookings. tap to choose one"
              onFile={async (file) => {
                setUploading(true);
                setError("");
                try {
                  setImageUrl(await uploadRoomImage(createClient(), userId ?? "anon", file));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload failed.");
                }
                setUploading(false);
              }}
            />
            <label style={labelStyle}>colour</label>
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
                    borderRadius: 9,
                    background: roomSurface(c).bg,
                    border: c === bgColor ? "2px solid var(--accent)" : "1px solid var(--border)",
                    transform: c === bgColor ? "rotate(-4deg) scale(1.12)" : "none",
                    cursor: "pointer",
                    transition: "transform 0.16s ease",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={busy || uploading}
                style={{
                  width: "auto",
                  padding: "11px 22px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "#131316",
                  fontFamily: "inherit",
                }}
              >
                {busy
                  ? "saving…"
                  : uploading
                    ? "waiting for upload…"
                    : editingId
                      ? "save changes"
                      : "create event"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError("");
                  resetForm();
                }}
                style={{
                  width: "auto",
                  padding: "11px 18px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "var(--card)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  fontFamily: "inherit",
                }}
              >
                cancel
              </button>
            </div>
          </form>
        )}

        {/* Calendar card: week strip or month grid */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: "14px 16px",
            boxShadow: "0 10px 26px var(--lift-soft)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>{monthLabel}</strong>
            <span style={{ flex: 1 }} />
            {(
              [
                ["week", "view_agenda", "week"],
                ["month", "calendar_month", "month"],
              ] as const
            ).map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setView(key);
                  setSelectedDay(null);
                }}
                aria-pressed={view === key}
                style={{
                  width: "auto",
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: view === key ? BUTTER : "var(--card)",
                  color: view === key ? "var(--text)" : "var(--muted)",
                  border: view === key ? inkBorder(0.25) : "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                  {icon}
                </span>
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                if (view === "month") setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                else setWeekOffset(0);
                setSelectedDay(dayKey(d));
              }}
              style={{
                width: "auto",
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                background: "var(--card)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              today
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === "month") setCalMonth(new Date(calYear, calMon - 1, 1));
                else setWeekOffset((v) => v - 1);
                setSelectedDay(null);
              }}
              aria-label={view === "month" ? "Previous month" : "Previous week"}
              style={circleBtn}
            >
              <span className="msr" style={{ fontSize: 17 }} aria-hidden>
                chevron_left
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (view === "month") setCalMonth(new Date(calYear, calMon + 1, 1));
                else setWeekOffset((v) => v + 1);
                setSelectedDay(null);
              }}
              aria-label={view === "month" ? "Next month" : "Next week"}
              style={circleBtn}
            >
              <span className="msr" style={{ fontSize: 17 }} aria-hidden>
                chevron_right
              </span>
            </button>
          </div>

          {view === "week" ? (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {stripDays.map(({ d, k }) => {
                const evs = eventsByDay.get(k) ?? [];
                const isToday = k === todayKey;
                const isSel = k === selectedDay;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedDay(isSel ? null : k)}
                    aria-pressed={isSel}
                    aria-label={`${dayName(d)}: ${evs.length} event${evs.length === 1 ? "" : "s"}`}
                    style={{
                      flex: 1,
                      minWidth: 46,
                      padding: "8px 4px 7px",
                      borderRadius: 12,
                      background: isToday ? BUTTER : "var(--card)",
                      border: isSel
                        ? "2px solid var(--accent)"
                        : isToday
                          ? inkBorder(0.22)
                          : "1px solid #eee8dc",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>
                      {d.toLocaleDateString([], { weekday: "short" }).toLowerCase()}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                      {d.getDate()}
                    </span>
                    <span style={{ display: "flex", gap: 3, height: 5 }} aria-hidden>
                      {evs.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: deepOf(e.bg_color),
                          }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {["s", "m", "t", "w", "t", "f", "s"].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: "center",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "var(--muted)",
                      padding: "2px 0",
                    }}
                    aria-hidden
                  >
                    {d}
                  </div>
                ))}
                {Array.from({ length: new Date(calYear, calMon, 1).getDay() }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: new Date(calYear, calMon + 1, 0).getDate() }).map((_, i) => {
                  const day = i + 1;
                  const k = dayKey(new Date(calYear, calMon, day));
                  const evs = eventsByDay.get(k) ?? [];
                  const isToday = k === todayKey;
                  const isSel = k === selectedDay;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedDay(isSel ? null : k)}
                      aria-pressed={isSel}
                      aria-label={`${day}: ${evs.length} event${evs.length === 1 ? "" : "s"}`}
                      style={{
                        padding: "6px 3px 5px",
                        minHeight: 60,
                        minWidth: 0,
                        borderRadius: 12,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 3,
                        background: isToday ? BUTTER : "var(--card)",
                        color: "var(--text)",
                        border: isSel
                          ? "2px solid var(--accent)"
                          : isToday
                            ? inkBorder(0.22)
                            : "1px solid #eee8dc",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isToday || isSel || evs.length > 0 ? 800 : 500,
                        }}
                      >
                        {day}
                      </span>
                      {evs.length > 0 && (
                        <>
                          <span
                            style={{
                              maxWidth: "100%",
                              boxSizing: "border-box",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: roomSurface(evs[0].bg_color).bg,
                            }}
                          >
                            {evs[0].title}
                          </span>
                          {evs.length > 1 && (
                            <span style={{ fontSize: 9.5, color: "var(--muted)" }}>
                              +{evs.length - 1} more
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--muted)",
                  margin: "10px 2px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {selectedDay
                  ? dayName(new Date(`${selectedDay}T12:00`))
                  : `${monthCount} event${monthCount === 1 ? "" : "s"} in ${calMonth
                      .toLocaleDateString([], { month: "long" })
                      .toLowerCase()}`}
                {selectedDay && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
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
                      fontFamily: "inherit",
                    }}
                  >
                    show whole month
                  </button>
                )}
              </p>
            </>
          )}
        </div>

        {/* The rule, said gently: a paragraph under the calendar, not a banner */}
        <AloneRule />

        {/* Search + scope row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label
            style={{
              flex: 1,
              minWidth: 200,
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "9px 13px",
              cursor: "text",
            }}
          >
            <span className="msr" style={{ fontSize: 18, color: "var(--muted)" }} aria-hidden>
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plans, places..."
              aria-label="Search events"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                fontSize: 14.5,
                color: "var(--text)",
                outline: "none",
                fontFamily: "inherit",
                padding: 0,
                margin: 0,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(
              [
                ["upcoming", "coming up"],
                ["booked", "your plans"],
                ["saved", "saved"],
                ["past", "past"],
              ] as [typeof scope, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                aria-pressed={scope === key}
                style={{
                  width: "auto",
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  background: scope === key ? "var(--accent)" : "var(--card)",
                  color: scope === key ? "#131316" : "var(--muted)",
                  border: scope === key ? "1px solid var(--accent)" : "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Agenda, grouped by day */}
        {sections.map(({ k, rows }) => (
          <div key={k}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 12px" }}>
              {k === todayKey && (
                <span
                  style={{
                    background: BUTTER,
                    border: inkBorder(0.16),
                    borderRadius: 999,
                    padding: "2px 11px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    transform: "rotate(-2deg)",
                  }}
                >
                  today
                </span>
              )}
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 20, margin: 0 }}>
                {dayName(new Date(`${k}T12:00`))}
              </h2>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {rows.length} plan{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            {rows.map((e) => {
              const st = stat(e);
              let goingBit = st.going === 0 ? "no one yet" : `${st.going} going`;
              if (st.spotsLeft != null && !st.isPast)
                goingBit += st.spotsLeft === 0 ? " · full" : ` · ${st.spotsLeft} left`;
              const sub = e.location ? `${placeLabel(e.location)} · ${goingBit}` : goingBit;
              const surface = roomSurface(e.bg_color);
              return (
                <div
                  key={e.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr",
                    gap: 12,
                    marginBottom: 12,
                    opacity: st.isPast ? 0.62 : 1,
                  }}
                >
                  <div style={{ paddingTop: 4 }}>
                    <span
                      style={{
                        display: "block",
                        background: surface.bg,
                        borderRadius: 999,
                        padding: "6px 4px",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--room-ink)",
                      }}
                    >
                      {fmtTime(e.starts_at)}
                    </span>
                  </div>
                  <div
                    className="lg-ev-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setOpenId(e.id);
                      }
                    }}
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      flexWrap: "wrap",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        flex: "none",
                        borderRadius: 12,
                        background: surface.bg,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        className="msr"
                        style={{ fontSize: 22, color: deepOf(e.bg_color) }}
                        aria-hidden
                      >
                        {catIcon(e.category)}
                      </span>
                    </span>
                    <span style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{e.title}</span>
                        {COMFORT.filter((c) => e[c.key]).map((c) => (
                          <ComfortBadge
                            key={c.key}
                            icon={c.icon}
                            label={c.short}
                            hint={c.hint}
                            size="row"
                            butter={c.key === "first_timer"}
                          />
                        ))}
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {sub}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                      <span style={{ display: "inline-flex" }} onClick={(ev) => ev.stopPropagation()}>
                        {st.att.slice(0, 3).map((a, i) => (
                          <ProfileTrigger
                            // Signed-out visitors get anonymous head-count rows
                            // that all share user_id "" — index keeps keys unique.
                            key={a.user_id || `anon-${i}`}
                            userId={a.user_id}
                            style={{ width: "auto", marginLeft: i ? -7 : 0, borderRadius: "50%", display: "inline-flex" }}
                          >
                            <span
                              title={a.display_name || "someone"}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: colorForUserId(a.user_id),
                                border: "2px solid var(--card)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: "#2b2733",
                              }}
                            >
                              {initialOf(a.display_name || "") || "\u{1F464}"}
                            </span>
                          </ProfileTrigger>
                        ))}
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleSave(e.id);
                        }}
                        aria-label={saves.has(e.id) ? "Saved. Tap to unsave" : "Save for later"}
                        title={saves.has(e.id) ? "Saved. Tap to unsave" : "Save for later"}
                        style={{
                          width: 28,
                          height: 28,
                          flex: "none",
                          padding: 0,
                          borderRadius: "50%",
                          background: saves.has(e.id) ? BUTTER : "var(--card)",
                          border: inkBorder(0.14),
                          color: "var(--text)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <span className="msr" style={{ fontSize: 15 }} aria-hidden>
                          {saves.has(e.id) ? "bookmark_added" : "bookmark"}
                        </span>
                      </button>
                      {!st.isPast && rowCta(e, st)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {sections.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 14.5, margin: "30px 0 0", fontFamily: SERIF }}>
            {emptyLine}
          </p>
        )}
      </main>

      {/* Event detail pop-up */}
      {open &&
        (() => {
          const st = stat(open);
          const surface = roomSurface(open.bg_color);
          const counts = reactCounts[open.id] ?? {};
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          const rel = st.isPast ? null : relOf(open.starts_at);
          const host = attendees.find(
            (a) => a.event_id === open.id && a.user_id === open.creator_id
          );
          const hostName = st.hosting ? "you" : host?.display_name || "someone";
          const guests = st.att.filter((a) => a.user_id);
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 18,
                boxSizing: "border-box",
              }}
            >
              <div
                onClick={() => setOpenId(null)}
                style={{ position: "absolute", inset: 0, background: "rgba(43, 39, 51, 0.45)" }}
              />
              <div
                role="dialog"
                aria-modal
                aria-label={open.title}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 530,
                  maxHeight: "88vh",
                  overflow: "auto",
                  background: "var(--card)",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  boxShadow: "0 30px 70px rgba(43, 39, 51, 0.35)",
                  animation: "lg-pop-in 0.22s ease",
                }}
              >
                <div style={{ background: surface.bg, padding: "22px 22px 18px", position: "relative" }}>
                  <span style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 7 }}>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(open)}
                          aria-label="Edit event"
                          title="Edit this event"
                          style={{ ...circleBtn, width: 32, height: 32, color: "var(--text)", border: inkBorder(0.14) }}
                        >
                          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(open)}
                          aria-label="Delete event"
                          title="Delete this event"
                          style={{ ...circleBtn, width: 32, height: 32, color: "var(--text)", border: inkBorder(0.14) }}
                        >
                          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                            delete
                          </span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      aria-label="Close"
                      style={{ ...circleBtn, width: 32, height: 32, color: "var(--text)", border: inkBorder(0.14) }}
                    >
                      <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                        close
                      </span>
                    </button>
                  </span>
                  {open.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={open.image_url}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        objectFit: "cover",
                        display: "inline-block",
                        border: "2px solid var(--card)",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "var(--card)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="msr" style={{ fontSize: 30, color: deepOf(open.bg_color) }} aria-hidden>
                        {catIcon(open.category)}
                      </span>
                    </span>
                  )}
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: BUTTER,
                        border: inkBorder(0.18),
                        borderRadius: 999,
                        padding: "2px 11px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: "inline-block",
                        transform: "rotate(-2deg)",
                        color: "#2b2733",
                      }}
                    >
                      {open.category}
                    </span>
                    {COMFORT.filter((c) => open[c.key]).map((c) => (
                      <ComfortBadge key={c.key} icon={c.icon} label={c.long} hint={c.hint} size="detail" />
                    ))}
                  </div>
                  <h2
                    style={{
                      fontFamily: SERIF,
                      fontWeight: 600,
                      fontSize: 27,
                      lineHeight: 1.15,
                      margin: "10px 0 4px",
                      color: "var(--room-ink)",
                    }}
                  >
                    {open.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--room-sub)" }}>hosted by {hostName}</p>
                </div>
                <div style={{ padding: "18px 22px 0" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                    <span className="msr" style={{ fontSize: 16, color: "var(--muted)" }} aria-hidden>
                      event
                    </span>
                    <span>
                      {rel && <strong>{rel} · </strong>}
                      {fmtWhen(open.starts_at)}
                    </span>
                  </p>
                  {open.location && (
                    <p
                      style={{
                        margin: "0 0 14px",
                        fontSize: 14,
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                        location_on
                      </span>
                      {isUrl(open.location) ? (
                        <a
                          href={open.location.trim()}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
                        >
                          {placeLabel(open.location)}
                        </a>
                      ) : (
                        open.location
                      )}
                    </p>
                  )}

                  {/*
                   * The single most useful thing on this card for a nervous
                   * first-timer, so it sits in the open, never behind a
                   * disclosure.
                   */}
                  {open.arrival_note && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 9,
                        border: "2px dashed rgba(43, 39, 51, 0.2)",
                        background: "#faf8f3",
                        borderRadius: 14,
                        padding: "11px 14px",
                        marginBottom: 14,
                      }}
                    >
                      <span
                        className="msr"
                        style={{ fontSize: 18, color: "var(--muted)", flex: "none", marginTop: 1 }}
                        aria-hidden
                      >
                        explore
                      </span>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                        <strong>your first 90 seconds:</strong> {open.arrival_note}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                    <Chip
                      active={reminders.has(open.id)}
                      icon={reminders.has(open.id) ? "notifications_active" : "notifications"}
                      label={reminders.has(open.id) ? "nudges you 1h before" : "remind me"}
                      onClick={() => toggleReminder(open.id)}
                    />
                    <a
                      href={icsHref(open)}
                      download={`${open.title.replace(/[^a-zA-Z0-9 _-]/g, "")}.ics`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 12px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 999,
                        background: "var(--card)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span className="msr" style={{ fontSize: 15 }} aria-hidden>
                        calendar_add_on
                      </span>
                      add to calendar
                    </a>
                    <Chip
                      active={copied}
                      icon={copied ? "check" : "link"}
                      label={copied ? "copied!" : "copy link"}
                      onClick={() => copyLink(open.id)}
                    />
                    <Chip
                      active={saves.has(open.id)}
                      icon={saves.has(open.id) ? "bookmark_added" : "bookmark"}
                      label={saves.has(open.id) ? "saved" : "save for later"}
                      onClick={() => toggleSave(open.id)}
                    />
                  </div>
                  {open.description && (
                    <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>
                      {open.description}
                    </p>
                  )}

                  {/* Hype meter */}
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: "14px 16px",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>hype meter</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{total} reactions</span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        overflow: "hidden",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, total * 3)}%`,
                          background: BUTTER,
                          borderRight: inkBorder(0.18),
                          transition: "width 0.25s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {REACTIONS.map(([kind, icon, label]) => {
                        const on = myReacts.has(`${open.id}:${kind}`);
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => toggleReact(open.id, kind)}
                            title={label}
                            aria-pressed={on}
                            style={{
                              width: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 11px",
                              fontSize: 12.5,
                              fontWeight: 700,
                              borderRadius: 999,
                              background: on ? BUTTER : "var(--card)",
                              color: "var(--text)",
                              border: on ? inkBorder(0.3) : "1px solid var(--border)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <span className="msr" style={{ fontSize: 15 }} aria-hidden>
                              {icon}
                            </span>
                            {counts[kind] ?? 0}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Guest list */}
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ margin: "0 0 9px", fontSize: 13, fontWeight: 700 }}>
                      who&apos;s going · {st.going}
                    </p>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {guests.map((a) => {
                        const isMe = a.user_id === userId;
                        const name = isMe ? "you" : (a.display_name || "someone").split(" ")[0];
                        return (
                          <ProfileTrigger
                            key={a.user_id}
                            userId={a.user_id}
                            style={{ width: "auto", display: "inline-flex", borderRadius: 999 }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                borderRadius: 999,
                                padding: "4px 11px 4px 5px",
                              }}
                            >
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: colorForUserId(a.user_id),
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#2b2733",
                                }}
                              >
                                {initialOf(a.display_name || "") || "\u{1F464}"}
                              </span>
                              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</span>
                              {a.user_id === open.creator_id && (
                                <span
                                  style={{
                                    background: BUTTER,
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    border: inkBorder(0.14),
                                  }}
                                >
                                  host
                                </span>
                              )}
                            </span>
                          </ProfileTrigger>
                        );
                      })}
                      {guests.length === 0 && (
                        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                          {st.going > 0
                            ? `${st.going} going`
                            : "no one yet, be the first"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Said on every event, not just the quiet ones */}
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: 13,
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    <span className="msr" style={{ fontSize: 16, flex: "none", marginTop: 1 }} aria-hidden>
                      hearing
                    </span>
                    you can come and not talk to anyone, just listening counts as showing up.
                  </p>

                  {st.onWl && (
                    <p
                      style={{
                        margin: "0 0 14px",
                        fontSize: 12.5,
                        background: BUTTER,
                        border: inkBorder(0.14),
                        borderRadius: 12,
                        padding: "9px 13px",
                      }}
                    >
                      you&apos;re #{st.pos + 1} in line. if a spot opens, it&apos;s yours.
                    </p>
                  )}
                </div>

                {/* Sticky footer */}
                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    background: "var(--card)",
                    borderTop: "1px solid #f0ece3",
                    padding: "14px 22px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {!userId && !st.isPast && (
                    <a
                      href="/login?next=/events"
                      style={{
                        flex: 1,
                        minWidth: 150,
                        padding: "12px 18px",
                        fontSize: 15,
                        fontWeight: 700,
                        borderRadius: 999,
                        background: "var(--accent)",
                        color: "#131316",
                        textAlign: "center",
                        boxSizing: "border-box",
                      }}
                    >
                      sign in to book
                    </a>
                  )}
                  {userId && !st.booked && !st.full && !st.isPast && (
                    <button
                      type="button"
                      onClick={() => book(open)}
                      style={{
                        width: "auto",
                        flex: 1,
                        minWidth: 150,
                        padding: "12px 18px",
                        fontSize: 15,
                        fontWeight: 700,
                        borderRadius: 999,
                        background: "var(--accent)",
                        color: "#131316",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      book a spot
                    </button>
                  )}
                  {userId && st.booked && (
                    <span
                      style={{
                        flex: 1,
                        minWidth: 150,
                        padding: "12px 18px",
                        fontSize: 15,
                        fontWeight: 700,
                        borderRadius: 999,
                        background: BUTTER,
                        border: inkBorder(0.18),
                        textAlign: "center",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        boxSizing: "border-box",
                      }}
                    >
                      <span className="msr" style={{ fontSize: 17 }} aria-hidden>
                        check
                      </span>
                      {st.hosting ? "you're hosting this one" : "you're going!"}
                    </span>
                  )}
                  {userId && !st.booked && st.full && !st.onWl && !st.isPast && (
                    <button
                      type="button"
                      onClick={() => joinWait(open)}
                      style={{
                        width: "auto",
                        flex: 1,
                        minWidth: 150,
                        padding: "12px 18px",
                        fontSize: 15,
                        fontWeight: 700,
                        borderRadius: 999,
                        background: BUTTER,
                        color: "var(--text)",
                        border: inkBorder(0.18),
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      join the waitlist
                    </button>
                  )}
                  {userId && st.onWl && (
                    <button
                      type="button"
                      onClick={() => leaveWait(open)}
                      style={{
                        width: "auto",
                        padding: "10px 15px",
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 999,
                        background: "var(--card)",
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      leave waitlist
                    </button>
                  )}
                  {userId && st.booked && !st.hosting && (
                    <button
                      type="button"
                      onClick={() => cancelBook(open)}
                      style={{
                        width: "auto",
                        padding: "10px 6px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "transparent",
                        color: "var(--muted)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                      }}
                    >
                      cancel my spot
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
