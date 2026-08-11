import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, isComplete } from "@/lib/profile";
import Onboarding from "@/app/onboarding/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already done? Don't make her sit through it again.
  const existing = await getOwnProfile(supabase, user.id);
  if (isComplete(existing)) redirect("/chat");

  return <Onboarding userId={user.id} initial={existing ?? undefined} />;
}
