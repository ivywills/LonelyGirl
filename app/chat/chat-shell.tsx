"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ChatSidebar, { type SidebarRoom } from "@/app/chat/chat-sidebar";

export default function ChatShell({
  rooms,
  children,
}: {
  rooms: SidebarRoom[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="chat-shell">
      <div
        className={`chat-sidebar-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <ChatSidebar rooms={rooms} className={open ? "open" : ""} />
      <div className="chat-main">
        <button
          type="button"
          className="chat-hamburger"
          aria-label="Toggle chat list"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="msr" style={{ fontSize: 18 }} aria-hidden>
            menu
          </span>
          Chats
        </button>
        {children}
      </div>
    </div>
  );
}
