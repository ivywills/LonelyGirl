import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/app/page-header";
import ModerationClient from "./moderation-client";

export const dynamic = "force-dynamic";

/*
 * Admin-only queue of user reports. RLS already hides the data from
 * non-admins; this gate just keeps the page itself from rendering empty.
 */
export default async function ModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) redirect("/");

  return (
    <>
      <PageHeader title="Moderation" backHref="/account" backLabel="account" />
      <main
        className="lg-under-topbar"
        style={{ padding: "18px 16px 40px", maxWidth: 760, margin: "0 auto", width: "100%" }}
      >
        <ModerationClient />
      </main>
    </>
  );
}
