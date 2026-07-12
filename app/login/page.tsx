import Link from "next/link";
import { logInWithEmail } from "@/app/auth/actions";
import GoogleButton from "@/app/auth/google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="center">
      <div className="card">
        <h1>Welcome back</h1>
        <p className="sub">Log in to LonelyGirl.</p>

        <GoogleButton label="Continue with Google" />

        <div className="divider">or log in with email</div>

        {error && <p className="msg-error">{error}</p>}

        <form action={logInWithEmail}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button className="primary" type="submit">
            Log in
          </button>
        </form>

        <p className="alt">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
