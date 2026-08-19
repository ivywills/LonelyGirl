"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/app/page-header";
import { Avatar } from "@/app/profile-card";
import { previewText } from "@/lib/message-preview";
import { roomSurface, type Room } from "@/app/chat/rooms-client";
import type { RoomActivity } from "@/app/chat/rooms-client";

export type LoungeMember = {
  user_id: string;
  name: string;
  avatar_url: string;
  avatar_color: string;
};

/*
 * The channel lounge: what /chat renders while only a couple of rooms are
 * live. A directory built for twelve rooms makes two look like an outage;
 * two big always-on channels make it look like the whole point — everyone
 * in the same rooms, nothing empty. rooms-client.tsx switches back to the
 * full directory automatically once more rooms are unhidden.
 */
export default function ChannelLounge({
  rooms,
  memberRoomIds,
  memberCounts,
  lastMessages,
  roomMembers,
  isAdmin,
  onManage,
  onMenu,
}: {
  rooms: Room[];
  memberRoomIds: string[];
  memberCounts: Record<string, number>;
  lastMessages: Record<string, RoomActivity>;
  roomMembers: Record<string, LoungeMember[]>;
  isAdmin: boolean;
  onManage: () => void;
  onMenu?: (() => void) | null;
}) {
  const router = useRouter();

  function activityLine(room: Room) {
    const last = lastMessages[room.id];
    if (!last) return null;
    const text = previewText(last, { verb: true }).slice(0, 70);
    const d = new Date(last.created_at);
    const when =
      d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString([], { day: "numeric", month: "short" });
    return `${last.display_name}: ${text} · ${when}`;
  }

  return (
    <>
      <style>{`@keyframes lgLivePulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }`}</style>
      <PageHeader title="Chatrooms" backHref="/" backLabel="change the channel" onMenu={onMenu}>
        {isAdmin && (
          <button type="button" className="lg-cta lg-hide-narrow" onClick={onManage}>
            <span className="msr" style={{ fontSize: 18 }} aria-hidden>
              tune
            </span>
            Manage rooms
          </button>
        )}
      </PageHeader>

      <main className="lg-page" style={{ maxWidth: 880 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            fontWeight: 600,
            margin: "4px 0 14px",
          }}
        >
          Live channels
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 18,
          }}
        >
          {rooms.map((room) => {
            const surface = roomSurface(room.bg_color);
            const members = roomMembers[room.id] ?? [];
            const count = memberCounts[room.id] ?? members.length;
            const joined = memberRoomIds.includes(room.id);
            const last = activityLine(room);
            return (
              <div
                key={room.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/chat/${room.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/chat/${room.id}`);
                  }
                }}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                }}
              >
                <div style={{ position: "relative", height: 158, background: surface.bg }}>
                  {room.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.image_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 52,
                        fontWeight: 600,
                        color: surface.ink,
                        opacity: 0.55,
                      }}
                    >
                      {room.name.slice(0, 1)}
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(10,10,14,0.62)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#ff5c5c",
                        animation: "lgLivePulse 1.8s ease-in-out infinite",
                      }}
                      aria-hidden
                    />
                    LIVE
                  </span>
                </div>

                <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <p style={{ fontSize: 19, fontWeight: 600 }}>{room.name}</p>
                  {room.description && (
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>{room.description}</p>
                  )}
                  {room.tags?.length > 0 && (
                    <p style={{ fontSize: 12, color: "var(--accent)", margin: "6px 0 0" }}>
                      {room.tags.map((t) => `#${t}`).join(" ")}
                    </p>
                  )}

                  {/* Everything from here down sticks to the card's bottom edge
                      as a group — the flexible gap sits above the members row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 14 }}>
                    <div style={{ display: "flex" }}>
                      {members.slice(0, 5).map((m, i) => (
                        <div
                          key={m.user_id}
                          style={{
                            marginLeft: i === 0 ? 0 : -8,
                            borderRadius: "50%",
                            border: "2px solid var(--card)",
                          }}
                        >
                          <Avatar
                            name={m.name}
                            color={m.avatar_color}
                            url={m.avatar_url || undefined}
                            size={26}
                          />
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {count} {count === 1 ? "member" : "members"}
                    </span>
                  </div>

                  {last && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        margin: "10px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {last}
                    </p>
                  )}

                  <div style={{ paddingTop: 16 }}>
                    <button
                      className="primary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/chat/${room.id}`);
                      }}
                    >
                      {joined ? "Enter the room" : room.is_private ? "Request to join" : "Join the room"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 26 }}>
          Come say hi — everyone&apos;s in one of these two. More rooms on the way.
        </p>
      </main>
    </>
  );
}
