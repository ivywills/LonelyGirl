import { createClient } from "@/lib/supabase/server";
import StaticIntro from "@/app/static-intro";
import TvPile from "@/app/tv-pile";
import HomeNav from "@/app/home-nav";

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
        <HomeNav signedIn={!!user} />
        <TvPile signedIn={!!user} />
      </main>
    </StaticIntro>
  );
}
