import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlaylistsClient, { PlaylistRow } from "@/app/playlists/playlists-client";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Every record is checked against every other one each frame, so cap how
  // many can pile up on the wall at once.
  const { data: playlists } = await supabase
    .from("playlists")
    // select("*") so the wall still loads against a database that hasn't had
    // the image_url migration run yet — the covers just come back empty
    .select("*")
    .order("created_at", { ascending: true })
    .limit(120);

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <PlaylistsClient
      rows={(playlists ?? []) as PlaylistRow[]}
      userId={user.id}
      displayName={displayName}
    />
  );
}
