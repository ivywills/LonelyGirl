import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatSidebar, { type SidebarRoom } from "@/app/chat/chat-sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room_id, chat_rooms(id, name, bg_color, image_url)")
    .eq("user_id", user.id);

  const baseRooms = (memberships ?? [])
    .map((m) => m.chat_rooms as unknown as Omit<SidebarRoom, "lastMessage"> | null)
    .filter((r): r is Omit<SidebarRoom, "lastMessage"> => !!r);

  const lastMessages = await Promise.all(
    baseRooms.map((r) =>
      supabase
        .from("messages")
        .select("display_name, content, kind, created_at")
        .eq("room_id", r.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );

  const rooms: SidebarRoom[] = baseRooms
    .map((r, i) => ({ ...r, lastMessage: lastMessages[i].data ?? null }))
    .sort((a, b) => (b.lastMessage?.created_at ?? "").localeCompare(a.lastMessage?.created_at ?? ""));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ChatSidebar rooms={rooms} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
