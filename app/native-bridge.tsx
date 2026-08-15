"use client";

import { useEffect } from "react";
import { isNativeMobile } from "@/lib/runtime";

/*
 * The native half of the mobile shell. Mounted in the root layout, but every
 * branch is behind isNativeMobile() and every Capacitor import is dynamic, so
 * in a browser tab this renders nothing and loads nothing.
 *
 * Three jobs:
 *  1. Finish a Google sign-in that was handed to the system browser — the
 *     deep link comes back as com.lonelygirl.app://auth/callback?code=...
 *  2. Make the Android back button behave like a back button instead of
 *     closing the app on the first press.
 *  3. Send external links (Shopify, playlist services, anywhere off-site) to
 *     the system browser. Letting them navigate the WebView strands the user
 *     outside the app with no way back — exactly the "repackaged website"
 *     seam App Review looks for (Guideline 4.2).
 */
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeMobile()) return;

    let disposed = false;
    const listeners: { remove: () => void }[] = [];

    (async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);
      if (disposed) return;

      listeners.push(
        await App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("com.lonelygirl.app://")) return;

          // The scheme isn't a valid base for URL(), so swap in a real one
          // purely to reuse its query parsing.
          const params = new URL(url.replace(/^com\.lonelygirl\.app:\/\//, "https://x/"))
            .searchParams;
          const code = params.get("code");
          const error = params.get("error_description") ?? params.get("error");

          // Close the SFSafariViewController/Custom Tab either way, so the
          // user is never left staring at a finished consent screen.
          await Browser.close().catch(() => {});

          if (!code) {
            window.location.replace(
              "/login?error=" + encodeURIComponent(error ?? "Could not sign you in. Please try again.")
            );
            return;
          }

          // Writes the session to cookies via the SSR browser client, which is
          // what the server components read on the reload below. Imported here
          // rather than at the top so this component — which sits in the root
          // layout — keeps the Supabase bundle off pages that never sign in.
          const { createClient } = await import("@/lib/supabase/client");
          const { error: exchangeError } = await createClient().auth.exchangeCodeForSession(code);
          window.location.replace(
            exchangeError
              ? "/login?error=" + encodeURIComponent(exchangeError.message)
              : "/"
          );
        })
      );

      listeners.push(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        })
      );

      const onClick = (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
        if (!anchor) return;
        const href = anchor.getAttribute("href") ?? "";
        if (!/^https?:\/\//i.test(href)) return; // relative and mailto: stay native
        if (new URL(href).origin === window.location.origin) return;
        e.preventDefault();
        Browser.open({ url: href });
      };
      document.addEventListener("click", onClick, true);
      listeners.push({ remove: () => document.removeEventListener("click", onClick, true) });
    })();

    return () => {
      disposed = true;
      listeners.forEach((l) => l.remove());
    };
  }, []);

  return null;
}
