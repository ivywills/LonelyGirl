"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ChatSidebar, { type SidebarRoom } from "@/app/chat/chat-sidebar";
import RoomsDock from "@/app/chat/rooms-dock";

/*
 * The narrow-screen sidebar toggle used to be a button floating above the page.
 * Now that every page starts with a sticky header bar, the toggle lives inside
 * that bar instead — the chat pages read it from here and hand it to
 * PageHeader. Outside the chat shell the default no-op means PageHeader simply
 * renders no menu button.
 */
const ChatMenuContext = createContext<(() => void) | null>(null);

export function useChatMenu() {
  return useContext(ChatMenuContext);
}

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

  // Inside a room the shell trades the 280px sidebar for the 74px dock and
  // drops the fixed-topbar padding — the room draws its own header.
  const inRoom = /^\/chat\/[^/]+$/.test(pathname ?? "");

  return (
    <ChatMenuContext.Provider value={() => setOpen((v) => !v)}>
      <div className={`chat-shell${inRoom ? " lg-room-mode" : ""}`}>
        <div
          className={`chat-sidebar-backdrop${open ? " open" : ""}`}
          onClick={() => setOpen(false)}
        />
        <ChatSidebar rooms={rooms} className={open ? "open" : ""} />
        {inRoom && <RoomsDock rooms={rooms} />}
        <div className="chat-main">{children}</div>
      </div>
    </ChatMenuContext.Provider>
  );
}
