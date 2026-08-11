import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { colorForUserId, getProfileCard } from "@/lib/profile";
import { Avatar } from "@/app/profile-card";
import PageHeader from "@/app/page-header";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  email: "Email",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileCard(supabase, user.id);
  const provider = user.app_metadata?.provider ?? "email";
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-CA", { month: "long", year: "numeric" })
    : null;

  return (
    <>
      <PageHeader title="Account" backHref="/" backLabel="back home" />
      <main className="center" style={{ minHeight: "calc(100dvh - var(--lg-topbar-h, 70px))" }}>
        <div className="card" style={{ position: "relative" }}>
        {/* Same exit the profile card has: × in the corner, straight home. */}
        <Link
          href="/"
          aria-label="Close account"
          title="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            fontSize: 16,
            lineHeight: 1,
            textDecoration: "none",
          }}
        >
          ×
        </Link>
        {/* Identity first — the profile she just built, not a wall of metadata. */}
        <div className="lg-acct-head">
          <Avatar
            name={profile?.name ?? ""}
            color={profile?.avatar_color || colorForUserId(user.id)}
            url={profile?.avatar_url || undefined}
            size={56}
          />
          <div style={{ minWidth: 0 }}>
            <h1 className="lg-acct-name">{profile?.name || "Your account"}</h1>
            <p className="lg-acct-where">
              {profile?.neighborhood ? `📍 ${profile.neighborhood}` : "Profile not set up yet"}
            </p>
          </div>
        </div>

        <dl className="lg-acct-rows">
          <div className="lg-acct-row">
            <dt className="k">Email</dt>
            <dd className="v">{user.email}</dd>
          </div>
          <div className="lg-acct-row">
            <dt className="k">Signed in with</dt>
            <dd className="v">{PROVIDER_LABELS[provider] ?? provider}</dd>
          </div>
          {joined && (
            <div className="lg-acct-row">
              <dt className="k">Member since</dt>
              <dd className="v">{joined}</dd>
            </div>
          )}
        </dl>

        <div className="lg-acct-actions">
          <Link className="lg-cta" href="/account/profile">
            <span className="msr" style={{ fontSize: 16 }} aria-hidden>
              edit
            </span>
            {profile?.name ? "Edit profile" : "Set up profile"}
          </Link>
          <form action={signOut}>
            <button className="lg-cta quiet" type="submit">
              Sign out
            </button>
          </form>
        </div>
        </div>
      </main>
    </>
  );
}
