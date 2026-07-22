"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      if (localStorage.getItem("lg-theme") === "light") setTheme("light");
    } catch {
      /* localStorage unavailable — stay on dark */
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("lg-theme", next);
    } catch {
      /* no persistence, still applies for this visit */
    }
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
  }

  return (
    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 60 }}>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: -1 }}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
        style={{
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
          // Sits over arbitrary surfaces (room colours, shop, TV pile) — the
          // shadow keeps it legible regardless of what's behind it
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
        }}
      >
        <span className="msr" style={{ fontSize: 18 }} aria-hidden>
          settings
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            width: 190,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 14,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.25)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              margin: "0 0 8px",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Appearance
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => choose(m)}
                style={{
                  flex: 1,
                  width: "auto",
                  padding: "6px 0",
                  fontSize: 12,
                  borderRadius: 8,
                  background: theme === m ? "var(--accent)" : "var(--bg)",
                  color: theme === m ? "#131316" : "var(--muted)",
                  border: "1px solid var(--border)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                  {m === "light" ? "light_mode" : "dark_mode"}
                </span>
                {m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
