import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INTRO_COOKIE } from "@/lib/intro";
import StaticIntro from "@/app/static-intro";
import TvWall from "@/app/tv-wall";
import HomeNav from "@/app/home-nav";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decided here rather than in the browser so the very first paint is either
  // the static or the wall — never a flash of one before the other
  const seenIntro = (await cookies()).has(INTRO_COOKIE);

  return (
    <StaticIntro seen={seenIntro}>
      <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <TvWall signedIn={!!user} />
        {/* Nav floats over the scene; pointer events pass through the strip
            so only the buttons themselves block the parallax */}
        <div
          style={{
            position: "absolute",
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "100%", maxWidth: 680, pointerEvents: "auto" }}>
            <HomeNav signedIn={!!user} />
          </div>
        </div>
      </main>
    </StaticIntro>
  );
}
