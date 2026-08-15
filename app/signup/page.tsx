import Link from "next/link";
import { signUpWithEmail } from "@/app/auth/actions";
import GoogleButton from "@/app/auth/google-button";
import AppleButton from "@/app/auth/apple-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; next?: string }>;
}) {
  const { error, success, next } = await searchParams;

  return (
    <main className="center">
      <div className="card">
        <h1>Create your account</h1>
        <p className="sub">Join LonelyGirl in seconds.</p>

        <GoogleButton label="Continue with Google" next={next} />
        {process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "1" && (
          <AppleButton label="Continue with Apple" next={next} />
        )}
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 14px", textAlign: "center" }}>
          Signing up means you agree to the <Link href="/terms">Terms of Use</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <div className="divider">or sign up with email</div>

        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-success">{success}</p>}

        <form action={signUpWithEmail}>
          {next && <input type="hidden" name="next" value={next} />}
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label htmlFor="password">Password (8+ characters)</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontSize: 13,
              margin: "2px 0 14px",
            }}
          >
            <input
              type="checkbox"
              name="terms"
              required
              style={{ width: "auto", margin: "2px 0 0" }}
            />
            <span>
              I agree to the <Link href="/terms">Terms of Use</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          <button className="primary" type="submit">
            Sign up
          </button>
        </form>

        <p className="alt">
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
