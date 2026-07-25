import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INTRO_COOKIE } from "@/lib/intro";

// Handles the OAuth (Google) and email-confirmation redirect from Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const response = NextResponse.redirect(
        !isLocal && forwardedHost ? `https://${forwardedHost}${next}` : `${origin}${next}`
      );
      // Fresh sign-in gets the static once
      response.cookies.delete(INTRO_COOKIE);
      return response;
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Could not sign you in. Please try again.")}`
  );
}
