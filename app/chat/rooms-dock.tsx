"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roomSurface } from "@/app/chat/rooms-client";
import { type SidebarRoom } from "@/app/chat/chat-sidebar";

/**
 * The 74px rooms dock shown beside an open room on desktop: back to the
 * directory up top, one circle per joined room, add-a-room at the bottom.
 * Rooms with a photo show it; the rest get their initial on the room pastel.
 */
export default function RoomsDock({ rooms }: { rooms: SidebarRoom[] }) {
  const pathname = usePathname();

  return (
    <nav className="lg-dock" aria-label="Your rooms">
      <Link
        href="/chat"
        title="All rooms"
        aria-label="All rooms"
        style={{
          width: 38,
          height: 38,
          flex: "none",
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px var(--lift-soft)",
        }}
      >
        <span className="msr" style={{ fontSize: 19 }} aria-hidden>
          arrow_back
        </span>
      </Link>
      <span
        aria-hidden
        style={{ width: 30, flex: "none", borderTop: "1px dashed rgba(20,116,180,0.4)" }}
      />
      {rooms.map((r) => {
        const active = pathname === `/chat/${r.id}`;
        const s = roomSurface(r.bg_color);
        return (
          <Link
            key={r.id}
            href={`/chat/${r.id}`}
            className={`lg-dock-room${active ? " active" : ""}`}
            title={r.name}
            aria-label={r.name}
            aria-current={active ? "page" : undefined}
            style={active ? undefined : { background: s.bg, color: s.ink }}
          >
            {r.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.image_url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              r.name.trim().charAt(0).toUpperCase() || "•"
            )}
          </Link>
        );
      })}
      <Link
        href="/chat"
        title="Find a room"
        aria-label="Find a room"
        style={{
          width: 40,
          height: 40,
          flex: "none",
          marginTop: "auto",
          borderRadius: "50%",
          border: "1.5px dashed rgba(20,116,180,0.4)",
          color: "var(--accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="msr" style={{ fontSize: 18 }} aria-hidden>
          add
        </span>
      </Link>
    </nav>
  );
}
