"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roomSurface } from "@/app/chat/rooms-client";
import { previewSender, previewText } from "@/lib/message-preview";

type LastMessage = {
  display_name: string;
  content: string;
  kind: string;
  created_at: string;
} | null;

export type SidebarRoom = {
  id: string;
  name: string;
  bg_color: string;
  image_url: string;
  lastMessage: LastMessage;
};

function formatSidebarTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "2-digit",
  });
}

/** Sender chip + message text, split so the name can render as a bubble. */
function previewParts(m: LastMessage): { name: string | null; text: string } {
  if (!m) return { name: null, text: "No messages yet" };
  return { name: previewSender(m), text: previewText(m) };
}

export default function ChatSidebar({
  rooms,
  className = "",
}: {
  rooms: SidebarRoom[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={`chat-sidebar ${className}`}>
      {rooms.map((r) => {
        const active = pathname === `/chat/${r.id}`;
        const s = roomSurface(r.bg_color);
        const ink = s.ink;
        const sub = s.sub;
        return (
          <Link
            key={r.id}
            href={`/chat/${r.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              background: s.bg,
              color: ink,
              textDecoration: "none",
              border: active ? "2px solid var(--accent)" : "2px solid transparent",
              overflow: "hidden",
            }}
          >
            {r.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.image_url}
                alt=""
                style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: s.tint,
                }}
              />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </span>
                {r.lastMessage && (
                  <span style={{ fontSize: 11, color: sub, flexShrink: 0 }}>
                    {formatSidebarTime(r.lastMessage.created_at)}
                  </span>
                )}
              </span>
              {(() => {
                const p = previewParts(r.lastMessage);
                return (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 2,
                      minWidth: 0,
                    }}
                  >
                    {p.name && (
                      <span
                        style={{
                          flexShrink: 0,
                          maxWidth: "45%",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: s.strip,
                          color: ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        color: ink,
                        opacity: p.name ? 0.8 : 0.66,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {p.text}
                    </span>
                  </span>
                );
              })()}
            </span>
          </Link>
        );
      })}
      {rooms.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--muted)", padding: "8px 10px" }}>
          Join a room to see it here.
        </p>
      )}
    </nav>
  );
}
