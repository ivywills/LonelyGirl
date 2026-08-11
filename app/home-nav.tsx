import Link from "next/link";

/*
 * The only account controls on the home screen. They use the same .lg-cta
 * family as every other account surface — signed out, "Sign up" is the solid
 * one and "Log in" sits back as a ghost, so there's a clear primary action
 * rather than two identical accent-coloured text links.
 */
export default function HomeNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header
      style={{
        width: "100%",
        maxWidth: 680,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 10,
        paddingRight: "max(16px, var(--safe-right))",
      }}
    >
      {signedIn ? (
        <Link className="lg-cta ghost" href="/account">
          <span className="msr" style={{ fontSize: 16 }} aria-hidden>
            person
          </span>
          Account
        </Link>
      ) : (
        <>
          <Link className="lg-cta ghost" href="/login">
            Log in
          </Link>
          <Link className="lg-cta" href="/signup">
            Sign up
          </Link>
        </>
      )}
    </header>
  );
}
