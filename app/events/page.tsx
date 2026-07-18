import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventsClient from "@/app/events/events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true })
    .limit(200);

  const ids = (events ?? []).map((e) => e.id);
  const { data: attendees } = ids.length
    ? await supabase.from("event_attendees").select("event_id, user_id, display_name").in("event_id", ids)
    : { data: [] };

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <EventsClient
      events={events ?? []}
      initialAttendees={attendees ?? []}
      userId={user.id}
      displayName={displayName}
    />
  );
}
