import Link from "next/link";
import PageHeader from "@/app/page-header";

export const metadata = { title: "Support — LonelyGirl" };

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support" backHref="/" backLabel="back home" />
      <main className="lg-under-topbar lg-legal">
        <h2>Something wrong?</h2>
        <p>
          Email <a href="mailto:ivywills@hotmail.com">ivywills@hotmail.com</a> and
          a human will get back to you.
        </p>

        <h2>Someone being awful?</h2>
        <p>
          Tap the flag on any message to report it, or open their profile to
          report or block them. Reports are reviewed promptly, normally within 24
          hours.
        </p>

        <h2>Want to leave?</h2>
        <p>
          Account → Delete account removes everything, permanently. See{" "}
          <Link href="/privacy">Privacy</Link> for what we keep and why.
        </p>
      </main>
    </>
  );
}
