import type { Metadata } from "next";
import "./globals.css";
import SettingsMenu from "@/app/settings-menu";

export const metadata: Metadata = {
  title: "LonelyGirl",
  description: "LonelyGirl",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,-50..200&display=swap"
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
        <SettingsMenu />
        {children}
      </body>
    </html>
  );
}
