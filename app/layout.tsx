import type { Metadata, Viewport } from "next";
import "./globals.css";
import SettingsMenu from "@/app/settings-menu";
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1e1e23" },
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Newsreader is the editorial accent on rail titles and room names */}
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        {/* Apply the saved theme before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("lg-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <NativeBridge />
        <SettingsMenu />
        {children}
      </body>
    </html>
  );
}
