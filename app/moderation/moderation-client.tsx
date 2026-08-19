"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  message_id: number | null;
  message_content: string;
  room_id: string | null;
  reason: string;
  created_at: string;
  resolved_at: string | null;
};

const actBtn: React.CSSProperties = {
  width: "auto",
  padding: "4px 12px",
  fontSize: 12,
};

export default function ModerationClient() {
  const supabase = createClient();
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [banned, setBanned] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const [reps, bans] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("user_bans").select("user_id"),
      ]);
      if (!live) return;
      const rows = (reps.data ?? []) as Report[];
      setReports(rows);
      setBanned(new Set((bans.data ?? []).map((b) => b.user_id)));
      const ids = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id])));
      if (ids.length) {
        const { data: cards } = await supabase
          .from("profile_cards")
          .select("user_id, name")
          .in("user_id", ids);
        if (live && cards) {
          setNames(Object.fromEntries(cards.map((c) => [c.user_id, c.name])));
        }
      }
      if (live) setLoaded(true);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameOf = (id: string) => names[id] || "unknown";

  async function deleteMessage(r: Report) {
    if (!r.message_id) return;
    if (!confirm("Delete the reported message?")) return;
    const { error: err } = await supabase.from("messages").delete().eq("id", r.message_id);
    if (err) setError(err.message);
    else setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, message_id: null } : x)));
  }

  async function toggleBan(r: Report) {
    const target = r.reported_user_id;
    if (banned.has(target)) {
      const { error: err } = await supabase.from("user_bans").delete().eq("user_id", target);
      if (err) setError(err.message);
      else
        setBanned((prev) => {
          const next = new Set(prev);
          next.delete(target);
          return next;
        });
    } else {
      if (!confirm(`Ban ${nameOf(target)}? They won't be able to post anywhere.`)) return;
      const { error: err } = await supabase.from("user_bans").insert({ user_id: target });
      if (err) setError(err.message);
      else setBanned((prev) => new Set(prev).add(target));
    }
  }

  async function resolve(r: Report) {
    const { data: auth } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("reports")
      .update({ resolved_at: new Date().toISOString(), resolved_by: auth.user?.id ?? null })
      .eq("id", r.id);
    if (err) setError(err.message);
    else
      setReports((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, resolved_at: new Date().toISOString() } : x))
      );
  }

  const open = reports.filter((r) => !r.resolved_at);
  const closed = reports.filter((r) => r.resolved_at);

  if (!loaded) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      {error && <p className="msg-error">{error}</p>}
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
        {open.length === 0
          ? "No open reports."
          : `${open.length} open ${open.length === 1 ? "report" : "reports"}.`}
      </p>
      {open.map((r) => (
        <div key={r.id} className="card" style={{ maxWidth: "none", margin: "0 0 12px", padding: 16 }}>
          <p style={{ fontSize: 13, margin: 0 }}>
            <strong>{nameOf(r.reported_user_id)}</strong>
            {banned.has(r.reported_user_id) && (
              <span style={{ color: "var(--muted)", fontSize: 12 }}> (banned)</span>
            )}
            <span style={{ color: "var(--muted)" }}>
              {" · reported by "}
              {nameOf(r.reporter_id)},{" "}
              {new Date(r.created_at).toLocaleDateString([], { day: "numeric", month: "short" })}
            </span>
          </p>
          {r.message_content && (
            <p
              style={{
                fontSize: 13,
                margin: "8px 0 0",
                padding: "8px 12px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {r.message_content}
              {!r.message_id && (
                <span style={{ color: "var(--muted)", fontSize: 12 }}> (message deleted)</span>
              )}
            </p>
          )}
          {r.reason && (
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--muted)" }}>“{r.reason}”</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {r.message_id && (
              <button type="button" style={actBtn} onClick={() => deleteMessage(r)}>
                Delete message
              </button>
            )}
            <button type="button" style={actBtn} onClick={() => toggleBan(r)}>
              {banned.has(r.reported_user_id) ? "Unban" : "Ban"} {nameOf(r.reported_user_id)}
            </button>
            <button type="button" style={actBtn} onClick={() => resolve(r)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {closed.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 18 }}>
          {closed.length} resolved {closed.length === 1 ? "report" : "reports"} in the last 100.
        </p>
      )}
    </>
  );
}
