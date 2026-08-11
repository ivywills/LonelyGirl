import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/profile";
import EditProfile from "@/app/account/profile/edit-client";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile(supabase, user.id);
  // Middleware sends an un-onboarded user to /onboarding, so this is defensive.
  if (!profile) redirect("/onboarding");

  return <EditProfile profile={profile} />;
}
