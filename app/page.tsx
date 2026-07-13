import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StaticIntro from "@/app/static-intro";
import TvPile from "@/app/tv-pile";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <StaticIntro>
      <main
        className="center"
        style={{ justifyContent: "flex-start", paddingTop: 40, gap: 8 }}
      >
        <header
          style={{
            width: "100%",
            maxWidth: 680,
            display: "flex",
            justifyContent: "flex-end",
            gap: 16,
            fontSize: 14,
          }}
        >
          {user ? (
            <Link href="/account">Account</Link>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </>
          )}
        </header>
        <TvPile signedIn={!!user} />
      </main>
    </StaticIntro>
  );
}
