import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeBridge from "@/app/native-bridge";

export const metadata: Metadata = {
  title: "LonelyGirl",
  description: "LonelyGirl",
  // Lets iOS run the site full-screen when it's saved to the home screen,
  // which is also how the Capacitor shell presents it.
  appleWebApp: { capable: true, title: "LonelyGirl", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The TV pile and the playlist wall are drag surfaces — pinch-zoom on a
  // phone fights them, and a double-tap on a record shouldn't zoom the page.
  maximumScale: 1,
  userScalable: false,
  // Draw under the notch/home indicator; globals.css pads with the safe areas.
  viewportFit: "cover",
  // The app is light-only for now, so the browser chrome shouldn't go dark
  // just because the device prefers it.
  themeColor: "#f4f2ee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * data-theme="light" is pinned here rather than chosen at runtime: the
   * settings gear that used to toggle it is gone for now. The dark palette is
   * still defined on :root in globals.css, so dropping this attribute (and
   * rendering SettingsMenu again) brings dark mode straight back.
   */
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Newsreader is the editorial accent on rail titles and room names */}
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NativeBridge />
        {children}
      </body>
    </html>
  );
}
