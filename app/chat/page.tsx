import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatDirectory, { type RoomActivity } from "@/app/chat/rooms-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: rooms },
    { data: sections },
    { data: memberships },
    { data: requests },
    { data: allMemberships },
    { data: adminRow },
  ] = await Promise.all([
    supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("room_sections").select("*").order("sort_order"),
    supabase.from("room_members").select("room_id").eq("user_id", user.id),
    supabase
      .from("join_requests")
      .select("*, chat_rooms(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("room_members").select("room_id").limit(10000),
    // Only admins can create rooms and sections. This drives the UI; the rule
    // itself is enforced by RLS (supabase/admins.sql and room-sections.sql), so
    // a stale or forged answer here hides or shows a button, never grants
    // anything.
    supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const memberCounts: Record<string, number> = {};
  (allMemberships ?? []).forEach((m) => {
    memberCounts[m.room_id] = (memberCounts[m.room_id] ?? 0) + 1;
  });

  const memberRoomIds = (memberships ?? []).map((m) => m.room_id as string);

  /*
   * The card's activity line and "active now" dot. Messages are members-only
   * under RLS, so this is only ever the rooms you're already in — a room you
   * haven't joined shows its tags instead. Capped so a long membership list
   * can't turn the directory into a hundred round trips.
   */
  const previewRoomIds = (rooms ?? []).map((r) => r.id).filter((id) => memberRoomIds.includes(id)).slice(0, 40);
  const previews = await Promise.all(
    previewRoomIds.map((id) =>
      supabase
        .from("messages")
        .select("display_name, content, kind, created_at")
        .eq("room_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
  const lastMessages: Record<string, RoomActivity> = {};
  previewRoomIds.forEach((id, i) => {
    const m = previews[i].data;
    if (m) lastMessages[id] = m as RoomActivity;
  });

  /*
   * With only a couple of live rooms the client renders the channel lounge,
   * which shows who's inside — fetch those faces here. Bounded: at most 3
   * rooms' members, one profile query.
   */
  const liveRooms = (rooms ?? []).filter((r) => !r.hidden_at);
  const roomMembers: Record<string, { user_id: string; name: string; avatar_url: string; avatar_color: string }[]> = {};
  if (liveRooms.length > 0 && liveRooms.length <= 3) {
    const { data: mems } = await supabase
      .from("room_members")
      .select("room_id, user_id")
      .in("room_id", liveRooms.map((r) => r.id))
      .limit(120);
    const ids = Array.from(new Set((mems ?? []).map((m) => m.user_id)));
    if (ids.length) {
      const { data: cards } = await supabase
        .from("profile_cards")
        .select("user_id, name, avatar_url, avatar_color")
        .in("user_id", ids);
      const byUser = Object.fromEntries((cards ?? []).map((c) => [c.user_id, c]));
      (mems ?? []).forEach((m) => {
        const card = byUser[m.user_id];
        if (!card) return;
        (roomMembers[m.room_id] = roomMembers[m.room_id] ?? []).push(card);
      });
    }
  }

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <ChatDirectory
      rooms={rooms ?? []}
      sections={sections ?? []}
      memberRoomIds={memberRoomIds}
      myRequests={requests ?? []}
      userId={user.id}
      displayName={displayName}
      memberCounts={memberCounts}
      lastMessages={lastMessages}
      isAdmin={!!adminRow}
      roomMembers={roomMembers}
    />
  );
}
