import Link from "next/link";
import PageHeader from "@/app/page-header";

export const metadata = { title: "Privacy · LonelyGirl" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy" backHref="/" backLabel="back home" />
      <main className="lg-under-topbar lg-legal">
        <p className="lg-legal-date">Last updated August 15, 2026</p>

        <p>The short version: we keep what the app needs to work, and nothing else.</p>

        <h2>What we collect</h2>
        <p>
          Your email and password (stored hashed, never readable by us), the
          profile you fill in, and the things you post: messages, images,
          playlists, event RSVPs. If you sign in with Google or Apple, they share
          your name and email with us and nothing more.
        </p>

        <h2>What we don&apos;t do</h2>
        <p>
          No ads, no analytics or tracking SDKs, no selling or sharing your data
          with anyone. We don&apos;t use your data for anything except running
          the app.
        </p>

        <h2>Where it lives</h2>
        <p>
          Data is stored with Supabase and the site is hosted on Vercel. Merch
          checkout happens on Shopify, and payment details go to them directly and
          never touch us.
        </p>

        <h2>Deleting your data</h2>
        <p>
          Account → Delete account removes your account and everything attached
          to it, permanently. If something&apos;s left behind or you want help,
          contact us via <Link href="/support">Support</Link>.
        </p>
      </main>
    </>
  );
}
