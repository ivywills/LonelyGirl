"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, isLight, uploadRoomImage } from "@/app/chat/rooms-client";

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
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
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
          className={`card ${isLight(bgColor) ? "on-theme-light" : "on-theme"}`}
          style={{ maxWidth: "none", marginBottom: 24, background: bgColor, transition: "background .3s" }}
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
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
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
                  background: c,
                  border: c === bgColor ? "2px solid var(--accent)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={womenOnly}
              onChange={(e) => setWomenOnly(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            <span className="msr" style={{ fontSize: 18, color: WOMEN_PINK }} aria-hidden>
              female
            </span>
            Women-only event
          </label>
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
            ["women", "Women only"],
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
              background:
                scope === key ? (key === "women" ? WOMEN_PINK : "var(--accent)") : "var(--card)",
              color: scope === key ? "#131316" : key === "women" ? WOMEN_PINK : "var(--muted)",
              border: "1px solid var(--border)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {key === "women" && (
              <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                female
              </span>
            )}
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
          const light = isLight(e.bg_color);
          const ink = light ? "#262130" : "var(--text)";
          const sub = light ? "rgba(38,33,48,0.62)" : "var(--muted)";
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
                background: e.bg_color,
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
                    background: light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)",
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
                  {e.is_women_only && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: light ? "#a83d76" : WOMEN_PINK,
                        marginLeft: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span className="msr" style={{ fontSize: 12, marginRight: 2 }} aria-hidden>
                        female
                      </span>
                      WOMEN ONLY
                    </span>
                  )}
                  {isPast && (
                    <span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>PAST</span>
                  )}
                </p>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                  <span className="msr" style={{ fontSize: 14, marginRight: 4 }} aria-hidden>
                    event
                  </span>
                  {formatWhen(e.starts_at)}
                </p>
                {e.location && (
                  <p style={{ fontSize: 13, color: sub, margin: "3px 0 0" }}>
                    <span className="msr" style={{ fontSize: 14, marginRight: 4 }} aria-hidden>
                      location_on
                    </span>
                    {e.location}
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
                  <span style={{ fontSize: 12, color: sub }}>
                    {going} going
                    {spotsLeft != null ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : ""}
                  </span>
                  {!isPast && (
                    <span style={{ marginLeft: "auto" }}>
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
