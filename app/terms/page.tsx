import Link from "next/link";
import PageHeader from "@/app/page-header";

export const metadata = { title: "Terms of Use · LonelyGirl" };

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of Use" backHref="/" backLabel="back home" />
      <main className="lg-under-topbar lg-legal">
        <p className="lg-legal-date">Last updated August 15, 2026</p>

        <p>
          LonelyGirl is a small community: chat rooms, playlists, events, and a
          shop. Using it means you agree to these terms.
        </p>

        <h2>Your account</h2>
        <p>
          You need an account for most of the app, and you have to be at least 13
          to make one. You&apos;re responsible for what happens on your account.
          You can delete it any time from the Account page, which permanently
          removes your profile, messages, and uploads.
        </p>

        <h2>Community rules</h2>
        <p>
          This is a shared space. There is no tolerance for objectionable content
          or abusive behaviour. That includes harassment, hate, threats, sexual
          content involving minors, impersonation, spam, and anything illegal.
        </p>
        <p>
          Every message can be reported, and every user can be blocked, so open
          someone&apos;s profile to do either. Reports are reviewed promptly,
          normally within 24 hours. Content that breaks these rules gets removed,
          and accounts that post it get banned.
        </p>

        <h2>Your content</h2>
        <p>
          What you post is yours. By posting it here you let us store and show it
          to the people you shared it with. We can remove content that breaks the
          rules.
        </p>

        <h2>The shop</h2>
        <p>
          Merch checkout runs through Shopify, under their terms of sale. We
          never see your payment details.
        </p>

        <h2>The boring parts</h2>
        <p>
          The app is provided as-is, without warranties. We may update these
          terms; meaningful changes will be noted here with a new date. If you
          have questions, see <Link href="/support">Support</Link>.
        </p>
      </main>
    </>
  );
}
