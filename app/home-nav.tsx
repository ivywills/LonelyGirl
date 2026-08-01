"use client";

import { useRouter } from "next/navigation";

const navButtonStyle: React.CSSProperties = {
  fontSize: 14,
  width: "auto",
  padding: 0,
  background: "transparent",
  border: "none",
  fontWeight: 400,
  color: "var(--accent)",
  cursor: "pointer",
};

export default function HomeNav({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  return (
    <header
      style={{
        width: "100%",
        maxWidth: 680,
        display: "flex",
        justifyContent: "flex-end",
        gap: 16,
        fontSize: 14,
        // Clears the fixed settings gear, which otherwise lands on top of
        // these links once the window is about phone-width. Same trick as
        // .page-header in globals.css; 48 also covers the gear's own
        // safe-area offset in landscape.
        paddingRight: 48,
      }}
    >
      {signedIn ? (
        <button type="button" style={navButtonStyle} onClick={() => router.push("/account")}>
          Account
        </button>
      ) : (
        <>
          <button type="button" style={navButtonStyle} onClick={() => router.push("/login")}>
            Log in
          </button>
          <button type="button" style={navButtonStyle} onClick={() => router.push("/signup")}>
            Sign up
          </button>
        </>
      )}
    </header>
  );
}
