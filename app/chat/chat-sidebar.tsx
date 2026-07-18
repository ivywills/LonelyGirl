"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLight } from "@/app/chat/rooms-client";

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

function previewText(m: LastMessage): string {
  if (!m) return "No messages yet";
  if (m.kind === "system") return m.content;
  if (m.kind === "gif") return `${m.display_name}: GIF`;
  const clean = m.content.replace(/\{\{emoji:[^|{}]+\|([^{}]+)\}\}/g, ":$1:");
  return `${m.display_name}: ${clean}`;
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
      <Link
        href="/chat"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        <span className="msr" style={{ fontSize: 18 }} aria-hidden>
          apps
        </span>
        Browse rooms
      </Link>
      {rooms.map((r) => {
        const active = pathname === `/chat/${r.id}`;
        const light = isLight(r.bg_color);
        const ink = light ? "#262130" : "#f4f2f8";
        const sub = light ? "rgba(38,33,48,0.68)" : "rgba(244,242,248,0.68)";
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
              background: r.bg_color,
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
                  background: light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
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
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: sub,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {previewText(r.lastMessage)}
              </span>
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
