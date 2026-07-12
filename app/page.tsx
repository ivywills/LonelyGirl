import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="center">
      <div className="card" style={{ textAlign: "center" }}>
        <h1>LonelyGirl</h1>
        <p className="sub">Coming soon.</p>
        {user ? (
          <p>
            Signed in as {user.email}. <Link href="/account">Account</Link>
          </p>
        ) : (
          <p>
            <Link href="/signup">Sign up</Link> ·{" "}
            <Link href="/login">Log in</Link>
          </p>
        )}
      </div>
    </main>
  );
}
