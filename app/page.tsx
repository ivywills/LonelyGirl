import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INTRO_COOKIE } from "@/lib/intro";
import StaticIntro from "@/app/static-intro";
import TvPile from "@/app/tv-pile";
import HomeNav from "@/app/home-nav";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decided here rather than in the browser so the very first paint is either
  // the static or the pile — never a flash of one before the other
  const seenIntro = (await cookies()).has(INTRO_COOKIE);

  return (
    <StaticIntro seen={seenIntro}>
      <main
        className="center"
        style={{ justifyContent: "flex-start", paddingTop: 40, gap: 8 }}
      >
        <HomeNav signedIn={!!user} />
        <TvPile signedIn={!!user} />
      </main>
    </StaticIntro>
  );
}
