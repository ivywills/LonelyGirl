"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/auth/actions";

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "Delete your account? Your profile, messages, and uploads are removed for good — there's no undo."
      )
    )
      return;
    setBusy(true);
    await deleteAccount();
  }

  return (
    <button
      type="button"
      className="lg-cta quiet"
      onClick={handleClick}
      disabled={busy}
      style={{ color: "#e5484d" }}
    >
      {busy ? "Deleting…" : "Delete account"}
    </button>
  );
}
