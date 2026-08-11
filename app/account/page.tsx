import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import Link from "next/link";
import { getProfileCard } from "@/lib/profile";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileCard(supabase, user.id);

  return (
    <main className="center">
      <div className="card">
        <h1>Your account</h1>
        <p className="sub">You are signed in.</p>
        <p style={{ marginBottom: 20 }}>
          <strong>Email:</strong> {user.email}
          <br />
          <strong>Provider:</strong> {user.app_metadata?.provider ?? "email"}
        </p>
        <p style={{ marginBottom: 20 }}>
          <strong>Profile:</strong>{" "}
          {profile?.name ? `${profile.name}${profile.neighborhood ? ` · ${profile.neighborhood}` : ""}` : "not set up yet"}
          <br />
          <Link href="/account/profile" style={{ textDecoration: "underline" }}>
            Edit profile
          </Link>
        </p>
        <form action={signOut}>
          <button className="primary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
