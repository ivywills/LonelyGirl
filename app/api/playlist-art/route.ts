import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/*
 * Reads what Apple already publishes on a playlist page — cover art, title and
 * track count — so pasting a link fills the record in by itself.
 *
 * This is the page's Open Graph tags, not the Apple Music API, which needs a
 * paid developer key and a signed token. The trade-off is that Apple owns this
 * markup: if they change it the fields come back empty and you type them in by
 * hand, which is why nothing here is required.
 */

const APPLE_HOST = "music.apple.com";

// Apple's image URLs end in a size segment (/1200x630wp-60.jpg). Swapping it
// for a centre-crop keeps wide editorial banners from arriving letterboxed.
function squareArt(ogImage: string) {
  const url = new URL(ogImage);
  url.search = "";
  url.pathname = url.pathname.replace(/\/[^/]+$/, "/540x540cc.jpg");
  return url.toString();
}

function meta(html: string, property: string) {
  return html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1] ?? "";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let target: URL;
  try {
    target = new URL(new URL(request.url).searchParams.get("url") ?? "");
  } catch {
    return NextResponse.json({ error: "That isn't a link." }, { status: 400 });
  }
  // The URL arrives from the browser, so pin it to Apple — anything looser
  // turns this route into a proxy for fetching arbitrary hosts
  if (target.protocol !== "https:" || target.hostname !== APPLE_HOST) {
    return NextResponse.json({ error: "Needs a music.apple.com link." }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LonelyGirl/1.0)",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(6000),
    });
    // A redirect off Apple means we're no longer reading what we asked for
    if (!res.ok || new URL(res.url).hostname !== APPLE_HOST) {
      return NextResponse.json({ error: "Couldn't find that playlist." }, { status: 404 });
    }
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Couldn't reach Apple Music." }, { status: 502 });
  }

  const ogImage = meta(html, "og:image");
  // "Okay then by Ivy Wills on Apple Music" -> "Okay then"
  const title = meta(html, "og:title")
    .replace(/\s+by\s+.*?\s+on Apple Music\s*$/i, "")
    .replace(/\s+on Apple Music\s*$/i, "")
    .trim();
  // The page JSON carries it exactly; og:description ("Playlist · 43 Songs")
  // is the fallback
  const rawCount =
    html.match(/"trackCount":(\d+)/)?.[1] ??
    meta(html, "og:description").match(/(\d+)\s+Songs?/i)?.[1] ??
    "";
  const songCount = parseInt(rawCount, 10);

  return NextResponse.json({
    image: ogImage ? squareArt(ogImage) : "",
    title,
    songCount: Number.isFinite(songCount) && songCount > 0 ? songCount : 0,
  });
}
