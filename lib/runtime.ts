/*
 * Where is this copy of the app running?
 *
 * The same Next.js build serves three shells — a browser tab, the Electron
 * desktop window, and the Capacitor WebView on iOS/Android — so a handful of
 * behaviours (mainly the Google sign-in hand-off) need to know which one it
 * is. Both checks are deliberately dependency-free and read a global the
 * shell injects, so importing this file costs the web build nothing.
 */

declare global {
  interface Window {
    // Set by electron/preload.js
    lonelygirl?: { desktop: true; platform: string; version: string };
    // Set by Capacitor's native runtime before our bundle evaluates
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

/** True inside the packaged desktop app. */
export function isDesktop() {
  return typeof window !== "undefined" && window.lonelygirl?.desktop === true;
}

/** True inside the iOS/Android WebView — false in a mobile browser. */
export function isNativeMobile() {
  return (
    typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true
  );
}

/** "ios" | "android" inside the native shell, otherwise "web". */
export function nativePlatform() {
  if (typeof window === "undefined") return "web";
  return window.Capacitor?.getPlatform?.() ?? "web";
}

/*
 * Custom URL scheme registered by both native projects. Google refuses to run
 * its consent screen inside an embedded WebView, so on iOS/Android we hand the
 * sign-in to the system browser and it hands control back here.
 */
export const NATIVE_AUTH_REDIRECT = "com.lonelygirl.app://auth/callback";
