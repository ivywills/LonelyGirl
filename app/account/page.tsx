import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
        <form action={signOut}>
          <button className="primary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
