"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cardTags, colorForUserId, initialOf, isSparse, jobOption, type ProfileCard as Card } from "@/lib/profile";
import { CARD_RING, SERIF, T } from "@/lib/profile-theme";

/** Avatar: photo if there is one, else the first letter on a solid pastel, else 👤. */
export function Avatar({
  name,
  color,
  url,
  size = 56,
}: {
  name: string;
  color: string;
  url?: string;
  size?: number;
}) {
  const letter = initialOf(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: url ? `center/cover url(${url})` : color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SERIF,
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        color: T.ink,
        userSelect: "none",
        overflow: "hidden",
      }}
      aria-hidden={!name}
    >
      {url ? "" : letter || "👤"}
    </div>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/*
 * The core reusable unit. Deliberately has no idea whether it's inside the
 * onboarding review step or a bottom sheet over the dark chat UI.
 *
 * "Going through" tags are not a prop here and must not become one — that data
 * lives in profile_private and is never fetched for anyone but its owner.
 */
export function ProfileCardView({ profile, width = 280 }: { profile: Card; width?: number }) {
  const tags = cardTags(profile);
  const job = jobOption(profile);
  const sparse = isSparse(profile);
  const color = profile.avatar_color || colorForUserId(profile.user_id);

  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        background: T.paper,
        borderRadius: 20,
        padding: 18,
        boxShadow: CARD_RING,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={profile.name} color={color} url={profile.avatar_url || undefined} size={56} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 600,
              color: T.ink,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {profile.name || "Someone"}
          </div>
          {profile.neighborhood ? (
            <div style={{ marginTop: 5 }}>
              <Pill bg={T.skyBadge} fg={T.skyInk}>📍 {profile.neighborhood}</Pill>
            </div>
          ) : null}
        </div>
      </div>

      {(profile.age_range || job) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {profile.age_range ? <Pill bg={T.sageTint} fg={T.ink}>{profile.age_range}</Pill> : null}
          {job ? <Pill bg={T.sageTint} fg={T.ink}>{job.emoji} {job.label}</Pill> : null}
        </div>
      )}

      {sparse ? (
        <>
          <div style={{ height: 1, background: T.tan2, margin: "14px 0" }} />
          <p style={{ margin: 0, fontSize: 13, color: T.faint }}>
            still filling out her profile ✨
          </p>
        </>
      ) : tags.length ? (
        <>
          <div style={{ height: 1, background: T.tan2, margin: "14px 0" }} />
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: T.faint,
              fontWeight: 600,
            }}
          >
            into
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tags.map((t) => (
              <Pill key={t.id} bg={T.butterTint} fg={T.ink}>{t.emoji} {t.label}</Pill>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/*
 * Bottom sheet wrapper for use from inside the dark chat / event UI. Fetches
 * the card itself so callers only need a user id.
 *
 * Also carries the safety actions (report / block / admin ban) so they exist
 * everywhere a profile can be opened — App Store Guideline 1.2 requires both
 * reporting and blocking to be reachable from user-generated content.
 */
export function ProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Card | null>(null);
  const [missing, setMissing] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [amAdmin, setAmAdmin] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [banned, setBanned] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    supabase
      .from("profile_cards")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        if (data) setProfile(data as Card);
        else setMissing(true);
      });
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!live || !user) return;
      setMe(user.id);
      if (user.id === userId) return;
      const [admin, block] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase
          .from("user_blocks")
          .select("blocked_id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", userId)
          .maybeSingle(),
      ]);
      if (!live) return;
      setBlocked(Boolean(block.data));
      if (admin.data === true) {
        setAmAdmin(true);
        const { data: ban } = await supabase
          .from("user_bans")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (live) setBanned(Boolean(ban));
      }
    });
    return () => {
      live = false;
    };
  }, [userId]);

  async function report() {
    if (!me) return;
    const reason = window.prompt("What's going on? A sentence helps the admins act on it.");
    if (reason === null) return;
    const { error } = await createClient().from("reports").insert({
      reporter_id: me,
      reported_user_id: userId,
      reason: reason.trim().slice(0, 500),
    });
    setNote(error ? "Couldn't send that report. Try again." : "Report sent. An admin will take a look.");
  }

  async function toggleBlock() {
    if (!me) return;
    const supabase = createClient();
    if (blocked) {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", me)
        .eq("blocked_id", userId);
      if (!error) setBlocked(false);
    } else {
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: me, blocked_id: userId });
      if (!error) {
        setBlocked(true);
        setNote("Blocked. You won't see their messages anymore.");
      }
    }
    // Chat screens listen for this and refresh their block list.
    window.dispatchEvent(new CustomEvent("lg-blocks-changed"));
  }

  async function toggleBan() {
    if (!me) return;
    const supabase = createClient();
    if (banned) {
      const { error } = await supabase.from("user_bans").delete().eq("user_id", userId);
      if (!error) {
        setBanned(false);
        setNote("Unbanned.");
      }
    } else {
      if (!confirm("Ban this account? They won't be able to post anywhere.")) return;
      const { error } = await supabase.from("user_bans").insert({ user_id: userId, banned_by: me });
      if (!error) {
        setBanned(true);
        setNote("Banned. They can no longer post.");
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(12,12,16,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "lgFade .2s ease-out",
      }}
    >
      <style>{`
        @keyframes lgFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lgSheet { from { transform: translateY(18px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "0 16px 28px",
          animation: "lgSheet .25s ease-out",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            alignSelf: "flex-end",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.16)",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        {profile ? (
          <ProfileCardView profile={profile} width={300} />
        ) : (
          <div
            style={{
              width: 300,
              background: T.paper,
              borderRadius: 20,
              padding: 22,
              boxShadow: CARD_RING,
              textAlign: "center",
              color: T.faint,
              fontSize: 13,
            }}
          >
            {missing ? "She hasn't set up a profile yet ✨" : "Loading…"}
          </div>
        )}
        {me && me !== userId && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "Report", onClick: report },
              { label: blocked ? "Unblock" : "Block", onClick: toggleBlock },
              ...(amAdmin ? [{ label: banned ? "Unban" : "Ban", onClick: toggleBan }] : []),
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                style={{
                  width: "auto",
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {note && (
          <p style={{ margin: 0, fontSize: 12, color: "#fff", opacity: 0.85, textAlign: "center" }}>{note}</p>
        )}
      </div>
    </div>
  );
}

/** Tap target used in message rows and attendee lists. */
export function ProfileTrigger({
  userId,
  children,
  style,
}: {
  userId: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          ...style,
        }}
      >
        {children}
      </button>
      {open ? <ProfileSheet userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
