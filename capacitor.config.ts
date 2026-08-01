import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

/*
 * The phone can't run the Next server, so unlike the desktop shell the mobile
 * app points at the deployed one. Set the URL once, in .env.local, and re-run
 * `npm run mobile:sync` — it's baked into the native projects at sync time,
 * not read at runtime.
 */

// The Capacitor CLI doesn't load .env files the way Next does, so read it here
// rather than making the documented workflow depend on an exported shell var.
function fromEnvLocal(key: string) {
  try {
    const file = readFileSync(join(__dirname, ".env.local"), "utf8");
    const match = file.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m"));
    return match?.[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined; // no .env.local — fall back to the process env
  }
}

const serverUrl =
  process.env.LONELYGIRL_SERVER_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  fromEnvLocal("LONELYGIRL_SERVER_URL") ??
  fromEnvLocal("NEXT_PUBLIC_SITE_URL");

if (!serverUrl) {
  console.warn(
    "\n[capacitor] LONELYGIRL_SERVER_URL is not set — the app will show the " +
      "placeholder screen in mobile/www instead of the real site.\n" +
      "  Fix: add LONELYGIRL_SERVER_URL=https://your-deployment to .env.local, " +
      "then re-run npm run mobile:sync\n"
  );
}

const config: CapacitorConfig = {
  appId: "com.lonelygirl.app",
  appName: "LonelyGirl",
  // Only reached when serverUrl is unset, or the device is offline.
  webDir: "mobile/www",
  backgroundColor: "#1e1e23",
  server: serverUrl
    ? {
        url: serverUrl,
        // Supabase auth cookies are Secure; plain HTTP would silently drop them.
        cleartext: false,
      }
    : undefined,
  ios: {
    // The page already pads itself with env(safe-area-inset-*), so let it draw
    // edge to edge rather than having WebKit inset the whole scroll view.
    contentInset: "never",
    backgroundColor: "#1e1e23",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#1e1e23",
  },
};

export default config;
