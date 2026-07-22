"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, roomSurface, uploadRoomImage } from "@/app/chat/rooms-client";

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

const WOMEN_PINK = "#ef99c2";

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

export default function EventsClient({
  events,
  initialAttendees,
  userId,
  displayName,
}: {
  events: EventRow[];
  initialAttendees: Attendee[];
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"upcoming" | "booked" | "hosting" | "past">("upcoming");
  const [activeCat, setActiveCat] = useState<string | null>(null);
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

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    attendees.forEach((a) => m.set(a.event_id, (m.get(a.event_id) ?? 0) + 1));
    return m;
  }, [attendees]);

  const myBookings = useMemo(
    () => new Set(attendees.filter((a) => a.user_id === userId).map((a) => a.event_id)),
    [attendees, userId]
  );

  const usedCats = useMemo(() => {
    const s = new Set(localEvents.map((e) => e.category));
    return EVENT_CATEGORIES.filter(([name]) => s.has(name)).map(([name]) => name);
  }, [localEvents]);

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
      const matchesCat = !activeCat || e.category === activeCat;
      const isPast = new Date(e.starts_at).getTime() < now;
      const matchesScope =
        (scope === "upcoming" && !isPast) ||
        (scope === "booked" && myBookings.has(e.id)) ||
        (scope === "hosting" && e.creator_id === userId) ||
        (scope === "past" && isPast);
      return matchesQuery && matchesCat && matchesScope;
    })
    .sort((a, b) =>
      scope === "past"
        ? b.starts_at.localeCompare(a.starts_at)
        : a.starts_at.localeCompare(b.starts_at)
    );

  async function book(e: EventRow) {
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("event_attendees")
      .insert({ event_id: e.id, user_id: userId, display_name: displayName });
    if (err) setError(err.message);
    else setAttendees((prev) => [...prev, { event_id: e.id, user_id: userId, display_name: displayName }]);
  }

  async function cancel(e: EventRow) {
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

  async function createEvent(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim() || !startsAt) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const cap = parseInt(capacity, 10);
    const { data, error: err } = await supabase
      .from("events")
      .insert({
        creator_id: userId,
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        starts_at: new Date(startsAt).toISOString(),
        capacity: Number.isFinite(cap) && cap > 0 ? cap : null,
        bg_color: bgColor,
        image_url: imageUrl.trim(),
      })
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
    setTitle("");
    setDescription("");
    setLocation("");
    setStartsAt("");
    setCapacity("");
    setImageUrl("");
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px", width: "100%" }}>
      <header className="page-header" style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26 }}>Events</h1>
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
          onClick={() => router.push("/chat")}
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
            forum
          </span>
          chatrooms
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
          {creating ? "Close" : "Host an event"}
        </button>
      </header>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>
        <span className="msr" style={{ fontSize: 15, color: WOMEN_PINK, marginRight: 4 }} aria-hidden>
          female
        </span>
        Find something to go to, book a spot, or host your own. Every event here is women-only.
      </p>

      {error && <p className="msg-error">{error}</p>}

      {creating && (
        <form
          onSubmit={createEvent}
          className="card on-room"
          style={{ maxWidth: "none", marginBottom: 24, background: roomSurface(bgColor).bg, transition: "background .3s" }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>New event</h2>
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
                setImageUrl(await uploadRoomImage(createClient(), userId, file));
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
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <span className="msr" style={{ fontSize: 16, color: WOMEN_PINK }} aria-hidden>
              female
            </span>
            Just so you know — every event on here is women-only.
          </p>
          <button className="primary" disabled={busy || uploading} type="submit">
            {busy ? "Creating…" : uploading ? "Waiting for upload…" : "Create event"}
          </button>
        </form>
      )}

      <input
        placeholder="Search events by title, place or description..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {(
          [
            ["upcoming", "Upcoming"],
            ["booked", "Booked"],
            ["hosting", "Hosting"],
            ["past", "Past"],
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
      {usedCats.length > 0 && (
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
          {usedCats.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(active ? null : c)}
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                  {catIcon(c)}
                </span>
                {c}
              </button>
            );
          })}
          {activeCat && (
            <button
              onClick={() => setActiveCat(null)}
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {visible.map((e) => {
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
                  <span
                    style={{ fontSize: 12, color: sub }}
                    title={attendees
                      .filter((a) => a.event_id === e.id)
                      .map((a) => a.display_name || "someone")
                      .join(", ")}
                  >
                    {going === 0
                      ? "No one yet — be the first"
                      : `${attendees
                          .filter((a) => a.event_id === e.id)
                          .slice(0, 2)
                          .map((a) => a.display_name || "someone")
                          .join(", ")}${going > 2 ? ` +${going - 2}` : ""} going`}
                    {spotsLeft != null ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : ""}
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
                      {booked ? (
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
        {visible.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            No events match — host the first one.
          </p>
        )}
      </div>
    </main>
  );
}
