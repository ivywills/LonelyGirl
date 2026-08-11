import type { Metadata } from "next";
import WaitlistForm from "@/app/waitlist/waitlist-form";

/*
 * The Instagram bio link. Deliberately outside the auth guard in middleware.ts
 * and outside the TV pile — someone arriving from a phone gets one screen, one
 * field, and no account to make.
 */

const BLURB =
  "A small, women-only community in Toronto. Chat rooms open at any hour, and things to turn up to — film nights, book clubs, long walks, dinners.";

export const metadata: Metadata = {
  title: "LonelyGirl — join the waitlist",
  description: BLURB,
  openGraph: {
    title: "Somewhere to gather when you're feeling alone.",
    description: BLURB,
    type: "website",
  },
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // ?from=instagram, ?from=story, ?from=poster … lands in waitlist.source so
  // you can tell which link actually works.
  const { from } = await searchParams;
  const source = (from ?? "").slice(0, 40);

  return (
    <main className="wl-sky">
      <div className="wl-card">
        <p className="wl-eyebrow">LonelyGirl — Toronto</p>

        <h1 className="lg-serif">
          Somewhere to gather when you&rsquo;re feeling alone.
        </h1>

        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          LonelyGirl is a small, women-only community in Toronto. Chat rooms
          that are open at any hour, and things to turn up to:
        </p>

        <div className="wl-tags">
          <span className="wl-tag">film nights</span>
          <span className="wl-tag">book clubs</span>
          <span className="wl-tag">long walks</span>
          <span className="wl-tag">dinners</span>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 10 }}>
          It stays small and supportive.
        </p>
        <p style={{ marginBottom: 24 }}>
          We open soon. Leave your email and we&rsquo;ll tell you when.
        </p>

        <WaitlistForm source={source} />
      </div>
    </main>
  );
}
