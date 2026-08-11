"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/*
 * The table has an insert policy and no select policy (supabase/waitlist.sql),
 * so this can add an address but can never read the list back. That shapes two
 * things: the insert deliberately doesn't chain .select(), and a duplicate
 * address comes back as a unique violation rather than something we looked up
 * first. Both are treated as success — the visitor gets the same answer either
 * way, and we never confirm to a stranger whether an address is on the list.
 */
export default function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState(""); // honeypot — humans never fill this
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError("");
    setState("sending");

    // A bot filled the hidden field: look like it worked, save nothing.
    if (trap) {
      setState("done");
      return;
    }

    const { error: err } = await createClient()
      .from("waitlist")
      .insert({ email: clean, source });

    // 23505 = already on the list. Same outcome for them as a fresh sign-up.
    if (err && err.code !== "23505") {
      setError("Something went wrong on our end. Try again in a moment?");
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div style={{ textAlign: "center" }}>
        <p className="lg-serif" style={{ fontSize: 26, fontWeight: 600, marginBottom: 8 }}>
          You&rsquo;re on the list.
        </p>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.5 }}>
          We&rsquo;ll email you once, when the doors open. Nothing before that.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="wl-email" style={{ fontSize: 13, color: "var(--muted)" }}>
        Your email
      </label>
      <input
        id="wl-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === "sending"}
        style={{ fontSize: 16, padding: "13px 14px", marginBottom: 12 }}
      />

      {/* Honeypot. Off-screen rather than display:none so bots still see it. */}
      <div aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="wl-website">Website</label>
        <input
          id="wl-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      {error && (
        <p className="msg-error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button className="primary" type="submit" disabled={state === "sending"} style={{ padding: 13 }}>
        {state === "sending" ? "Saving…" : "Save me a spot"}
      </button>

      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
        One email when we open. No newsletter, and your address never goes
        anywhere else.
      </p>
    </form>
  );
}
