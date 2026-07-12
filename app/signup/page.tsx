import Link from "next/link";
import { signUpWithEmail } from "@/app/auth/actions";
import GoogleButton from "@/app/auth/google-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <main className="center">
      <div className="card">
        <h1>Create your account</h1>
        <p className="sub">Join LonelyGirl in seconds.</p>

        <GoogleButton label="Continue with Google" />

        <div className="divider">or sign up with email</div>

        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-success">{success}</p>}

        <form action={signUpWithEmail}>
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
          <button className="primary" type="submit">
            Sign up
          </button>
        </form>

        <p className="alt">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
