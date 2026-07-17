import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomClient from "@/app/chat/[id]/room-client";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room } = await supabase.from("chat_rooms").select("*").eq("id", id).single();
  if (!room) notFound();

  const [{ data: membership }, { data: myRequest }, { data: messages }] = await Promise.all([
    supabase.from("room_members").select("user_id").eq("room_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("join_requests").select("*").eq("room_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("messages").select("*").eq("room_id", id).order("created_at", { ascending: true }).limit(200),
  ]);

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <RoomClient
      room={room}
      userId={user.id}
      displayName={displayName}
      isMember={!!membership}
      myRequest={myRequest ?? null}
      initialMessages={messages ?? []}
    />
  );
}
