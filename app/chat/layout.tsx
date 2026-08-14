import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatShell from "@/app/chat/chat-shell";
import { type SidebarRoom } from "@/app/chat/chat-sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room_id, chat_rooms(id, name, bg_color, image_url, hidden_at)")
    .eq("user_id", user.id);

  /*
   * Archived rooms stay out of everyone's sidebar. RLS already hides them
   * from regular members (the embed comes back null); the hidden_at check
   * covers admins, who can still see the rows — they manage archived rooms
   * from the directory's Archive rail instead.
   */
  const baseRooms = (memberships ?? [])
    .map((m) => m.chat_rooms as unknown as (Omit<SidebarRoom, "lastMessage"> & { hidden_at: string | null }) | null)
    .filter((r): r is Omit<SidebarRoom, "lastMessage"> & { hidden_at: string | null } => !!r && !r.hidden_at);

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

  return <ChatShell rooms={rooms}>{children}</ChatShell>;
}
