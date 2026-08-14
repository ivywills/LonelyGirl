import { createClient } from "@/lib/supabase/server";
import EventsClient from "@/app/events/events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public on purpose: the events list is the strongest reason for a visitor
  // from Instagram to make an account, so they need to see it first. Reading
  // is open (anon select policy in supabase/public-read.sql); booking and
  // hosting still require an account.
  const [{ data: events }, { data: adminRow }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true })
      .limit(200),
    // Hosting is admin-only. This shows/hides the button; the rule itself is
    // RLS (supabase/events-admin.sql), so a forged answer grants nothing.
    user
      ? supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ids = (events ?? []).map((e) => e.id);

  /*
   * Signed in: the real attendee rows, so "Booked" and the names resolve.
   * Signed out: head counts only, via a security-definer function — who is
   * going to an event is not public. The counts are padded into anonymous
   * placeholder rows so the card's "N going" and "Full" logic is unchanged;
   * they carry no user_id, so nothing renders as a person.
   */
  let attendees: { event_id: string; user_id: string; display_name: string }[] = [];
  if (ids.length) {
    if (user) {
      const { data } = await supabase
        .from("event_attendees")
        .select("event_id, user_id, display_name")
        .in("event_id", ids);
      attendees = data ?? [];
    } else {
      const { data } = await supabase.rpc("event_attendee_counts");
      attendees = (data ?? []).flatMap(
        (row: { event_id: string; going: number }) =>
          ids.includes(row.event_id)
            ? Array.from({ length: Number(row.going) }, () => ({
                event_id: row.event_id,
                user_id: "",
                display_name: "",
              }))
            : []
      );
    }
  }

  const displayName = user
    ? (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "anon"
    : "";

  return (
    <EventsClient
      events={events ?? []}
      initialAttendees={attendees}
      userId={user?.id ?? null}
      displayName={displayName}
      isAdmin={!!adminRow}
    />
  );
}
