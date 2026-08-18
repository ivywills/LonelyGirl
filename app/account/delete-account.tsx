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
    // Destructive and rare — a quiet text link under the real actions, not a
    // peer button she could hit by muscle memory.
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        width: "auto",
        alignSelf: "center",
        marginTop: 4,
        padding: "6px 8px",
        background: "transparent",
        border: "none",
        fontSize: 13,
        fontWeight: 500,
        color: "#e5484d",
        textDecoration: "underline",
        textUnderlineOffset: 3,
        cursor: "pointer",
      }}
    >
      {busy ? "Deleting…" : "Delete account"}
    </button>
  );
}
