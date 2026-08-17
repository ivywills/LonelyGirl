"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePicker, ROOM_COLORS, roomSurface } from "@/app/chat/rooms-client";
import PageHeader from "@/app/page-header";
import DecoClip from "@/app/deco-clip";

export type ScrapbookRow = {
  id: string;
  author_id: string;
  display_name: string;
  caption: string;
  image_url: string;
  bg_color: string;
  rotation: number;
  created_at: string;
};

/*
 * The scrapbook is a shared wall of pinned photos and notes — the loose,
 * personal counterpart to the structured pages (rooms, playlists, events).
 *
 * Its own storage bucket rather than reusing room-images, so a photo pinned
 * here can never be mistaken for a room's cover art, and so the two can be
 * cleaned up independently.
 */
async function uploadScrapbookImage(
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
  const { error } = await supabase.storage.from("scrapbook-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("scrapbook-images").getPublicUrl(path).data.publicUrl;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export default function ScrapbookClient({
  initialEntries,
  userId,
  displayName,
}: {
  initialEntries: ScrapbookRow[];
  // null when signed out: the wall is public to read, so the compose and
  // delete paths bail early and the header offers sign-in instead.
  userId: string | null;
  displayName: string;
}) {
  const [entries, setEntries] = useState<ScrapbookRow[]>(initialEntries);
  const [composing, setComposing] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [color, setColor] = useState(ROOM_COLORS[0]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  function reset() {
    setCaption("");
    setImageUrl("");
    setColor(ROOM_COLORS[0]);
    setError("");
    setComposing(false);
  }

  async function handleFile(file: File) {
    if (!userId) return;
    setUploading(true);
    setError("");
    try {
      setImageUrl(await uploadScrapbookImage(supabase, userId, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That upload didn't work.");
    } finally {
      setUploading(false);
    }
  }

  async function pin() {
    if (!userId) return;
    if (!caption.trim() && !imageUrl) {
      setError("Add a photo or a few words — otherwise there's nothing to pin.");
      return;
    }
    setSaving(true);
    setError("");
    // Tilt is stored, not computed at render, so a pinned scrap keeps the
    // same angle every time anyone loads the page.
    const rotation = Math.round((Math.random() * 8 - 4) * 10) / 10;
    const { data, error: insertError } = await supabase
      .from("scrapbook_entries")
      .insert({
        author_id: userId,
        display_name: displayName,
        caption: caption.trim(),
        image_url: imageUrl,
        bg_color: color,
        rotation,
      })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setEntries((prev) => [data as ScrapbookRow, ...prev]);
    reset();
  }

  async function remove(id: string) {
    if (!userId) return;
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error: deleteError } = await supabase
      .from("scrapbook_entries")
      .delete()
      .eq("id", id);
    if (deleteError) setEntries(previous); // put it back if the server said no
  }

  return (
    <>
      <PageHeader title="Scrapbook" backHref="/" backLabel="change the channel">
        {userId ? (
          <button type="button" className="lg-cta" onClick={() => setComposing((c) => !c)}>
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              {composing ? "close" : "push_pin"}
            </span>
            {composing ? "Close" : "Pin something"}
          </button>
        ) : (
          <a className="lg-cta" href="/login?next=/scrapbook">
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              login
            </span>
            Sign in to pin
          </a>
        )}
      </PageHeader>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, margin: "0 0 6px" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Bits and pieces worth keeping.
          </p>
          <DecoClip src="/scrapbook-camera.mp4" size={84} />
        </div>

      {composing && (
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 18,
            margin: "18px 0 26px",
            display: "grid",
            gap: 14,
          }}
        >
          <ImagePicker
            id="scrapbook-image"
            imageUrl={imageUrl}
            uploading={uploading}
            onFile={handleFile}
            title="Add a photo"
            hint="Tap to choose a picture — or skip it and just leave a note"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 280))}
            placeholder="Say something about it…"
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              font: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Paper</span>
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: roomSurface(c).bg,
                  border:
                    c === color ? "2px solid var(--text)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>
          {error && <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={pin}
              disabled={saving || uploading}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                cursor: saving || uploading ? "default" : "pointer",
                opacity: saving || uploading ? 0.6 : 1,
              }}
            >
              {saving ? "Pinning…" : "Pin it"}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {entries.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: 40 }}>
          Nothing pinned yet. Add the first scrap.
        </p>
      ) : (
        // Masonry via CSS columns: scraps are different heights and should
        // pack up the page rather than sit in a ragged grid.
        <div
          style={{
            columnWidth: 260,
            columnGap: 18,
            marginTop: 18,
          }}
        >
          {entries.map((entry) => {
            const surface = roomSurface(entry.bg_color);
            return (
              <article
                key={entry.id}
                style={{
                  breakInside: "avoid",
                  marginBottom: 18,
                  background: surface.bg,
                  color: surface.ink,
                  borderRadius: 14,
                  padding: 12,
                  transform: `rotate(${entry.rotation}deg)`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                }}
              >
                {entry.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.image_url}
                    alt=""
                    style={{
                      width: "100%",
                      display: "block",
                      borderRadius: 8,
                      marginBottom: entry.caption ? 10 : 0,
                    }}
                  />
                )}
                {entry.caption && (
                  <p style={{ margin: "0 0 8px", lineHeight: 1.45 }}>{entry.caption}</p>
                )}
                <footer
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: surface.sub,
                  }}
                >
                  <span>{entry.display_name || "anon"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatWhen(entry.created_at)}</span>
                  {entry.author_id === userId && (
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      style={{
                        marginLeft: "auto",
                        border: "none",
                        background: "transparent",
                        color: surface.sub,
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      remove
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
      </main>
    </>
  );
}
