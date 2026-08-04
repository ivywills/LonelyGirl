import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScrapbookClient from "@/app/scrapbook/scrapbook-client";

export const dynamic = "force-dynamic";

export default async function ScrapbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("scrapbook_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon";

  return (
    <ScrapbookClient
      initialEntries={entries ?? []}
      userId={user.id}
      displayName={displayName}
    />
  );
}
