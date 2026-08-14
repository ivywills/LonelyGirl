import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add code between createServerClient and getUser() —
  // it can cause hard-to-debug session issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  /*
   * Areas that need an account. Anything not listed (/, /waitlist, /login,
   * /signup, /auth/*) stays open — the Instagram bio link has to work without
   * one. /events is open too: browsing is public, and the page itself asks
   * for sign-in only when she tries to book or host.
   */
  const GUARDED = ["/account", "/chat", "/playlists", "/scrapbook", "/shop"];
  const isGuarded = GUARDED.some((p) => path.startsWith(p));

  // Protect signed-in areas: redirect signed-out users to /login
  if (!user && isGuarded) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where she was headed so login can send her back there.
    url.search = "";
    url.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(url);
  }

  /*
   * Onboarding gate. A signed-in user with no name/neighborhood can't reach any
   * guarded area until she's finished — every screen downstream assumes a
   * profile exists rather than falling back to user_metadata.
   *
   * One indexed primary-key lookup, and only on guarded paths, so the open
   * pages (/waitlist especially) stay a zero-query render.
   */
  if (user && isGuarded && !path.startsWith("/onboarding")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, neighborhood")
      .eq("user_id", user.id)
      .maybeSingle();

    const complete = Boolean(profile?.name?.trim() && profile?.neighborhood?.trim());
    if (!complete) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
