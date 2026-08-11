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
 */
export function ProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Card | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    createClient()
      .from("profile_cards")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        if (data) setProfile(data as Card);
        else setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

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
