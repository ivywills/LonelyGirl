"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, roomSurface, uploadRoomImage } from "@/app/chat/rooms-client";
import { ProfileTrigger } from "@/app/profile-card";
import { colorForUserId, initialOf } from "@/lib/profile";
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
};

type Attendee = { event_id: string; user_id: string; display_name: string };

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

/** Local-time day bucket, "YYYY-MM-DD" — the calendar's key for everything. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

// "Today" / "Tomorrow" / "In 4 days" for anything within the week
function relDay(iso: string): string | null {
  const d = new Date(iso);
  const now = new Date();
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(d) - midnight(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
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

/** ISO → the local "YYYY-MM-DDTHH:mm" a datetime-local input wants. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventsClient({
  events,
  initialAttendees,
  userId,
  displayName,
  isAdmin = false,
}: {
  events: EventRow[];
  initialAttendees: Attendee[];
  // null when signed out: the page is public to read, so every write path
  // below bails early and the UI offers sign-in instead of the action.
  userId: string | null;
  displayName: string;
  /** Hosting is admin-only — RLS in supabase/events-admin.sql is the rule. */
  isAdmin?: boolean;
}) {
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"upcoming" | "booked" | "past">("upcoming");
  const [view, setView] = useState<"list" | "calendar">("list");
  // First of the month the calendar is showing, and the tapped day ("YYYY-MM-DD")
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Phone-only: whether the collapsed scope row is showing
  const [showScope, setShowScope] = useState(false);
  /*
   * The long placeholder doesn't fit on a phone. Starts false so the server
   * and first client render agree, then settles on mount — same 600px
   * breakpoint the stylesheet uses.
   */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [localEvents, setLocalEvents] = useState<EventRow[]>(events);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(EVENT_CATEGORIES[0][0]);
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgColor, setBgColor] = useState(ROOM_COLORS[11]);
  // When set, the form above edits this event instead of creating a new one
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setCreating(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    attendees.forEach((a) => m.set(a.event_id, (m.get(a.event_id) ?? 0) + 1));
    return m;
  }, [attendees]);

  const myBookings = useMemo(
    () => new Set(attendees.filter((a) => a.user_id === userId).map((a) => a.event_id)),
    [attendees, userId]
  );

  const now = Date.now();
  const visible = localEvents
    .filter((e) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.category.includes(q);
      const isPast = new Date(e.starts_at).getTime() < now;
      const matchesScope =
        (scope === "upcoming" && !isPast) ||
        (scope === "booked" && myBookings.has(e.id)) ||
        (scope === "past" && isPast);
      return matchesQuery && matchesScope;
    })
    .sort((a, b) =>
      scope === "past"
        ? b.starts_at.localeCompare(a.starts_at)
        : a.starts_at.localeCompare(b.starts_at)
    );

  // Calendar bookkeeping: events bucketed by local day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    localEvents.forEach((e) => {
      const k = dayKey(new Date(e.starts_at));
      map.set(k, [...(map.get(k) ?? []), e]);
    });
    map.forEach((list) => list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    return map;
  }, [localEvents]);

  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth();
  const monthEvents = useMemo(
    () =>
      localEvents
        .filter((e) => {
          const d = new Date(e.starts_at);
          return d.getFullYear() === calYear && d.getMonth() === calMon;
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [localEvents, calYear, calMon]
  );
  // What the card grid shows: the tapped day, else the whole month on screen
  const calVisible = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : monthEvents;
  const shown = view === "calendar" ? calVisible : visible;

  async function book(e: EventRow) {
    if (!userId) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_attendees")
      .insert({ event_id: e.id, user_id: userId, display_name: displayName });
    if (err) setError(err.message);
    else setAttendees((prev) => [...prev, { event_id: e.id, user_id: userId, display_name: displayName }]);
  }

  async function cancel(e: EventRow) {
    if (!userId) return;
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", e.id)
      .eq("user_id", userId);
    if (err) setError(err.message);
    else setAttendees((prev) => prev.filter((a) => !(a.event_id === e.id && a.user_id === userId)));
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
    }
  }

  async function saveEvent(ev: React.FormEvent) {
    ev.preventDefault();
    if (!userId) return;
    if (!title.trim() || !startsAt) return;
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
        prev.map((x) => (x.id === editingId ? (data as EventRow) : x)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
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
    setLocalEvents((prev) =>
      [...prev, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    );
    setAttendees((prev) => [...prev, { event_id: data.id, user_id: userId, display_name: displayName }]);
    setCreating(false);
    setBusy(false);
    resetForm();
  }

  return (
    <>
      <PageHeader
        title="Events"
        backHref="/"
        backLabel="change the channel"
      >
        {/* Hidden on phones, like the chat directory's create button.
            Hosting is admin-only, so everyone else gets no CTA at all. */}
        {isAdmin && (
          <button
            type="button"
            className="lg-cta lg-hide-narrow"
            onClick={() => {
              if (creating) resetForm();
              setCreating((v) => !v);
            }}
          >
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              {creating ? "close" : "add_circle"}
            </span>
            {creating ? "Close" : "Host an event"}
          </button>
        )}
      </PageHeader>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 60px", width: "100%" }}>
      {error && <p className="msg-error">{error}</p>}

      {creating && isAdmin && (
        <form
          onSubmit={saveEvent}
          className="card on-room"
          style={{ maxWidth: "none", marginBottom: 24, background: roomSurface(bgColor).bg, transition: "background .3s" }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>{editingId ? "Edit event" : "New event"}</h2>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What's happening?"
          />
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
            {EVENT_CATEGORIES.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label>When</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <label>Where</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            placeholder="A place, a park, a link..."
          />
          <label>Spots (leave empty for unlimited)</label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="unlimited"
          />
          <label>Event picture</label>
          <ImagePicker
            id="create-event-image"
            imageUrl={imageUrl}
            uploading={uploading}
            title="Add an event photo"
            hint="Events with a picture get way more bookings — tap to choose one"
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
          <label>Colour</label>
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
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" disabled={busy || uploading} type="submit" style={{ width: "auto", flex: 1 }}>
              {busy
                ? "Saving…"
                : uploading
                  ? "Waiting for upload…"
                  : editingId
                    ? "Save changes"
                    : "Create event"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
              style={{ width: "auto", padding: "8px 18px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List ↔ calendar switch */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(
          [
            ["list", "view_agenda", "List"],
            ["calendar", "calendar_month", "Calendar"],
          ] as const
        ).map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            style={{
              width: "auto",
              padding: "5px 14px",
              fontSize: 13,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: view === key ? "var(--accent)" : "var(--card)",
              color: view === key ? "#131316" : "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="msr" style={{ fontSize: 16 }} aria-hidden>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <>
          <input
            placeholder={narrow ? "Search events" : "Search events by title, place or description..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search events"
            style={{ marginBottom: 10 }}
          />
          <div className="lg-filter-head" style={{ marginBottom: 18 }}>
            {/* Phone-only: the scope pills live behind this until tapped */}
            <button
              type="button"
              className="lg-filter-btn"
              onClick={() => setShowScope((v) => !v)}
              aria-expanded={showScope}
              aria-label={scope === "upcoming" ? "Filter events" : `Filter events — showing ${scope}`}
              title="Filter events"
            >
              <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                tune
              </span>
              {scope !== "upcoming" && <span className="lg-filter-dot" aria-hidden />}
            </button>
            <div className={`lg-scope-row lg-scope-row--start${showScope ? " open" : ""}`}>
              {(
                [
                  ["upcoming", "Upcoming"],
                  ["booked", "Booked"],
                  ["past", "Past"],
                ] as [typeof scope, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setScope(key);
                    setShowScope(false);
                  }}
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
          </div>
        </>
      ) : (
        (() => {
          const firstDow = new Date(calYear, calMon, 1).getDay();
          const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
          const todayKey = dayKey(new Date());
          return (
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCalMonth(new Date(calYear, calMon - 1, 1));
                    setSelectedDay(null);
                  }}
                  aria-label="Previous month"
                  style={{
                    width: 30,
                    height: 30,
                    padding: 0,
                    borderRadius: "50%",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                    chevron_left
                  </span>
                </button>
                <strong style={{ fontSize: 15, minWidth: 150, textAlign: "center" }}>
                  {calMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    setCalMonth(new Date(calYear, calMon + 1, 1));
                    setSelectedDay(null);
                  }}
                  aria-label="Next month"
                  style={{
                    width: 30,
                    height: 30,
                    padding: 0,
                    borderRadius: "50%",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <span className="msr" style={{ fontSize: 18 }} aria-hidden>
                    chevron_right
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    setSelectedDay(dayKey(d));
                  }}
                  style={{
                    width: "auto",
                    marginLeft: "auto",
                    padding: 0,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--muted)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Today
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", padding: "2px 0" }} aria-hidden>
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
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
                      aria-label={`${day} — ${evs.length} event${evs.length === 1 ? "" : "s"}`}
                      style={{
                        padding: "6px 0 5px",
                        minHeight: 46,
                        borderRadius: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                        background: isSel ? "var(--accent)" : "var(--card)",
                        color: isSel ? "#131316" : "var(--text)",
                        border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: isToday || isSel ? 700 : 400 }}>{day}</span>
                      {evs.length > 0 && (
                        <span style={{ display: "flex", gap: 3 }} aria-hidden>
                          {evs.slice(0, 3).map((e) => (
                            <span
                              key={e.id}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: isSel ? "#131316" : roomSurface(e.bg_color).bg,
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
                {selectedDay
                  ? `${new Date(`${selectedDay}T12:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })} · ${calVisible.length} event${calVisible.length === 1 ? "" : "s"}`
                  : `${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"} this month`}
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
                    }}
                  >
                    show whole month
                  </button>
                )}
              </p>
            </div>
          );
        })()
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {shown.map((e) => {
          const s = roomSurface(e.bg_color);
          const ink = s.ink;
          const sub = s.sub;
          const going = counts.get(e.id) ?? 0;
          const isPast = new Date(e.starts_at).getTime() < now;
          const booked = myBookings.has(e.id);
          const full = e.capacity != null && going >= e.capacity;
          const spotsLeft = e.capacity != null ? Math.max(0, e.capacity - going) : null;
          return (
            <div
              key={e.id}
              style={{
                color: ink,
                background: s.bg,
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
                opacity: isPast ? 0.55 : 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {e.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.image_url}
                  alt=""
                  style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    height: 64,
                    background: s.tint,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="msr" style={{ fontSize: 32, color: sub }} aria-hidden>
                    {catIcon(e.category)}
                  </span>
                </div>
              )}
              <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>
                  {e.title}
                  {isPast && (
                    <span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>PAST</span>
                  )}
                </p>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                  <span className="msr" style={{ fontSize: 14, marginRight: 4 }} aria-hidden>
                    event
                  </span>
                  {!isPast && relDay(e.starts_at) && (
                    <strong style={{ marginRight: 4 }}>{relDay(e.starts_at)} ·</strong>
                  )}
                  {formatWhen(e.starts_at)}
                </p>
                {e.location && (
                  <p style={{ fontSize: 13, color: sub, margin: "3px 0 0" }}>
                    <span className="msr" style={{ fontSize: 14, marginRight: 4 }} aria-hidden>
                      location_on
                    </span>
                    {isUrl(e.location) ? (
                      <a
                        href={e.location.trim()}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        {e.location.trim().replace(/^https?:\/\//i, "").slice(0, 40)}
                      </a>
                    ) : (
                      e.location
                    )}
                  </p>
                )}
                {e.description && (
                  <p style={{ fontSize: 13, color: sub, margin: "6px 0 0" }}>{e.description}</p>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: "auto",
                    paddingTop: 12,
                  }}
                >
                  {/*
                    Overlapping avatar circles instead of the old "X, Y +N going"
                    text. Colour and initial come from the attendee row we already
                    have, so this stays one query — tapping fetches the real card.
                  */}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: sub, minWidth: 0 }}>
                    {going === 0 ? (
                      "No one yet — be the first"
                    ) : (
                      <>
                        <span style={{ display: "inline-flex" }}>
                          {attendees
                            .filter((a) => a.event_id === e.id)
                            .slice(0, 4)
                            .map((a, i) => (
                              <ProfileTrigger
                                // Signed-out visitors get anonymous head-count
                                // rows that all share user_id "" — fall back to
                                // the index so keys stay unique.
                                key={a.user_id || `anon-${i}`}
                                userId={a.user_id}
                                style={{ marginLeft: i ? -8 : 0, borderRadius: "50%", display: "inline-flex" }}
                              >
                                <span
                                  title={a.display_name || "someone"}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: colorForUserId(a.user_id),
                                    border: "2px solid var(--card)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#2b2733",
                                  }}
                                >
                                  {initialOf(a.display_name || "") || "\u{1F464}"}
                                </span>
                              </ProfileTrigger>
                            ))}
                        </span>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {going > 4 ? `+${going - 4} ` : ""}going
                        </span>
                      </>
                    )}
                    {spotsLeft != null ? ` \u00B7 ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : ""}
                  </span>
                  {!isPast && (
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
                      {booked && (
                        <a
                          href={icsHref(e)}
                          download={`${e.title.replace(/[^a-zA-Z0-9 _-]/g, "")}.ics`}
                          aria-label="Add to calendar"
                          title="Add to your calendar"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            color: "inherit",
                          }}
                        >
                          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                            calendar_add_on
                          </span>
                        </a>
                      )}
                      {e.creator_id === userId && (
                        <button
                          onClick={() => openEdit(e)}
                          aria-label="Edit event"
                          title="Edit this event"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            borderRadius: 8,
                            background: "transparent",
                            border: "1px solid var(--border)",
                            color: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                            edit
                          </span>
                        </button>
                      )}
                      {e.creator_id === userId && (
                        <button
                          onClick={() => deleteEvent(e)}
                          aria-label="Delete event"
                          title="Delete this event"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            borderRadius: 8,
                            background: "transparent",
                            border: "1px solid var(--border)",
                            color: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
                            delete
                          </span>
                        </button>
                      )}
                      {!userId ? (
                        <a
                          className="primary"
                          href="/login?next=/events"
                          style={{
                            width: "auto",
                            padding: "5px 14px",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 8,
                            textDecoration: "none",
                          }}
                        >
                          Sign in to book
                        </a>
                      ) : booked ? (
                        <button
                          onClick={() => cancel(e)}
                          style={{ width: "auto", padding: "5px 14px", fontSize: 12 }}
                        >
                          {e.creator_id === userId ? "Hosting" : "Booked — cancel"}
                        </button>
                      ) : full ? (
                        <span style={{ fontSize: 12, color: sub }}>Full</span>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => book(e)}
                          style={{ width: "auto", padding: "5px 14px", fontSize: 12 }}
                        >
                          Book a spot
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Calendar view already says "N events" in its count line */}
        {shown.length === 0 && view === "list" && (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            No events here yet — check back soon.
          </p>
        )}
      </div>
      </main>
    </>
  );
}
