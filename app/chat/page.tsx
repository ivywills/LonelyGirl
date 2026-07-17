import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatDirectory from "@/app/chat/rooms-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rooms }, { data: memberships }, { data: requests }] =
    await Promise.all([
      supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
      supabase
        .from("join_requests")
        .select("*, chat_rooms(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <ChatDirectory
      rooms={rooms ?? []}
      memberRoomIds={(memberships ?? []).map((m) => m.room_id as string)}
      myRequests={requests ?? []}
      userId={user.id}
      displayName={displayName}
    />
  );
}
