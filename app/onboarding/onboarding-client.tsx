"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_RANGES,
  AVATAR_COLORS,
  cityById,
  FITNESS,
  HOBBIES,
  JOBS,
  STRUGGLES,
  type Option,
} from "@/lib/profile-options";
import { CHIP_COLORS, chip, ONBOARDING_RING, SERIF, T } from "@/lib/profile-theme";
import { ProfileCardView, Avatar } from "@/app/profile-card";
import SearchableChips, { inputStyle } from "@/app/chip-select";
import { saveProfile, type ProfileInput } from "@/app/onboarding/actions";
import type { ProfileCard } from "@/lib/profile";

const STEPS = 9;

/** Same rules as uploadRoomImage, different bucket. Path is userId/… so RLS can check ownership. */
async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["heic", "heif"].includes(ext) || /hei[cf]/i.test(file.type)) {
    throw new Error(
      "iPhone HEIC photos can't be shown in most browsers — pick a JPG or PNG, or screenshot the photo and upload that."
    );
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5MB — try a smaller one.");
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
      {Array.from({ length: STEPS }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 5,
            background: i <= step ? T.butterDeep : T.tan2,
            // The segment she's on glows a little; done ones just stay warm.
            boxShadow: i === step ? `0 0 6px 1px ${T.butterDeep}88` : "none",
            transition: "background .2s, box-shadow .2s",
          }}
        />
      ))}
    </div>
  );
}

function StepTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <>
      <h1 style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: T.ink, margin: "0 0 6px", lineHeight: 1.25 }}>
        {children}
      </h1>
      {sub ? <p style={{ color: T.muted, fontSize: 14, margin: "0 0 18px" }}>{sub}</p> : null}
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, color: T.faint, margin: "0 0 8px", fontWeight: 700, letterSpacing: ".06em" }}>
      {children}
    </p>
  );
}

export default function Onboarding({
  userId,
  initial,
}: {
  userId: string;
  initial?: Partial<ProfileInput>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? "");
  const [avatarColor, setAvatarColor] = useState(initial?.avatar_color ?? AVATAR_COLORS[0]);
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [age, setAge] = useState(initial?.age_range ?? "");
  const [job, setJob] = useState(initial?.job ?? "");
  const [hobbies, setHobbies] = useState<string[]>(initial?.hobbies ?? []);
  const [fitness, setFitness] = useState<string[]>(initial?.fitness ?? []);
  const [struggles, setStruggles] = useState<string[]>(initial?.struggles ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const city = cityById(initial?.city_id ?? "toronto");
  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // Neighbourhoods are plain strings; give them the same Option shape so the
  // one searchable chip component covers every list in the flow.
  const neighborhoodOptions: Option[] = useMemo(
    () => city.neighborhoods.map((n) => ({ id: n, emoji: "", label: n })),
    [city]
  );

  // Only name and neighborhood block continuing — everything else is optional
  // on purpose, that's the whole reason this is 8 short screens and not a form.
  const blocked = (step === 1 && !name.trim()) || (step === 2 && !neighborhood);

  const preview: ProfileCard = {
    user_id: userId,
    name,
    avatar_url: avatarUrl,
    avatar_color: avatarColor,
    city_id: city.id,
    neighborhood,
    age_range: age,
    job,
    hobbies,
    fitness,
    onboarded_at: null,
  };

  function finish() {
    setError("");
    start(async () => {
      const res = await saveProfile(
        {
          name,
          avatar_url: avatarUrl,
          avatar_color: avatarColor,
          city_id: city.id,
          neighborhood,
          age_range: age,
          job,
          hobbies,
          fitness,
          struggles,
          show_age: true,
          show_job: true,
        },
        { finishOnboarding: true }
      );
      if (!res.ok) setError(res.error);
      else window.location.href = "/chat";
    });
  }

  return (
    /*
     * The page itself never scrolls. The card is capped to the viewport and
     * split into three: a fixed head, a scrolling middle, and a pinned footer —
     * so Continue is reachable on a short phone without hunting for it, and the
     * lists can grow without ever pushing it off screen.
     */
    <main
      className="wl-sky"
      style={{
        // A definite height, not just a max: the card's maxHeight is a
        // percentage, and percentages don't resolve against min/max alone —
        // without this the card can silently outgrow a short screen and put
        // the Continue button past the bottom edge with no way to scroll.
        height: "100dvh",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        overflow: "hidden",
      }}
    >
      <div
        className="wl-card"
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: T.paper,
          borderRadius: 22,
          padding: "clamp(18px, 4.2vw, 26px)",
          boxShadow: ONBOARDING_RING,
          boxSizing: "border-box",
        }}
      >
        {/* ---- fixed head ---- */}
        <div style={{ flex: "none" }}>
          {/* One stable row every step: back circle on the left (hidden but
              still occupying its spot on step 1, so nothing jumps), step pill
              on the right. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Back"
              disabled={step === 0}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.paper,
                border: `1.5px solid ${T.tan2}`,
                color: T.muted,
                fontSize: 15,
                lineHeight: 1,
                padding: 0,
                cursor: "pointer",
                flex: "none",
                visibility: step === 0 ? "hidden" : "visible",
              }}
            >
              ←
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 11px",
                borderRadius: 999,
                background: T.butterTint,
                color: T.ink,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {step + 1} / {STEPS}
            </span>
          </div>
          <ProgressBar step={step} />
        </div>

        {/* ---- scrolling middle ---- */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            // Pull the scrollbar to the card edge without clipping chip shadows.
            marginRight: -6,
            paddingRight: 6,
          }}
        >
          {step === 0 && (
            <>
              <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden>💌</div>
              <StepTitle sub="A few quick things so the girls you meet know who you are. Most of it's optional — skip anything you'd rather not say.">
                Let&rsquo;s set up your profile
              </StepTitle>
            </>
          )}

          {step === 1 && (
            <>
              <StepTitle sub="Just a first name is fine.">What should we call you?</StepTitle>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <Avatar name={name} color={avatarColor} url={avatarUrl || undefined} size={72} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name"
                  maxLength={40}
                  autoFocus
                  style={{ ...inputStyle, fontSize: 15 }}
                />
              </div>

              <input
                id="onb-avatar"
                type="file"
                accept="image/*"
                disabled={uploading}
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  setError("");
                  try {
                    setAvatarUrl(await uploadAvatar(userId, file));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed.");
                  }
                  setUploading(false);
                }}
              />
              <label
                htmlFor="onb-avatar"
                style={{ display: "inline-block", fontSize: 13, color: T.skyInk, cursor: uploading ? "wait" : "pointer", textDecoration: "underline", marginBottom: 14 }}
              >
                {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo instead"}
              </label>

              {!avatarUrl && (
                <>
                  <Label>OR PICK A COLOUR</Label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        aria-label={`Colour ${c}`}
                        style={{
                          width: 30,
                          height: 30,
                          padding: 0,
                          borderRadius: "50%",
                          background: c,
                          cursor: "pointer",
                          border: avatarColor === c ? `2.5px solid ${T.ink}` : "2.5px solid transparent",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle sub="So you can find girls nearby.">Where in the city?</StepTitle>
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: T.skyBadge, color: T.skyInk }}>
                  📍 {city.label}
                </span>
              </div>
              <SearchableChips
                options={neighborhoodOptions}
                selected={neighborhood ? [neighborhood] : []}
                onToggle={(id) => setNeighborhood(neighborhood === id ? "" : id)}
                colors={CHIP_COLORS.neighborhood}
                placeholder="Search neighbourhoods"
              />
            </>
          )}

          {/* Age and job were one "basics" step, but together they overflow a
              short phone and push Continue off screen — split, each fits. */}
          {step === 3 && (
            <>
              <StepTitle sub="Optional, and you can hide it later.">How old are you?</StepTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AGE_RANGES.map((a) => (
                  <button key={a} type="button" onClick={() => setAge(age === a ? "" : a)} aria-pressed={age === a} style={chip(age === a, ...CHIP_COLORS.basics)}>
                    {a}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle sub="Optional, and you can hide it later.">What do you do?</StepTitle>
              <SearchableChips
                options={JOBS}
                selected={job ? [job] : []}
                onToggle={(id) => setJob(job === id ? "" : id)}
                colors={CHIP_COLORS.basics}
                placeholder="Search job fields"
              />
            </>
          )}

          {step === 5 && (
            <>
              <StepTitle sub="Pick as many as you like.">What are you into?</StepTitle>
              <SearchableChips
                options={HOBBIES}
                selected={hobbies}
                onToggle={toggle(hobbies, setHobbies)}
                colors={CHIP_COLORS.hobbies}
                placeholder="Search interests"
              />
            </>
          )}

          {step === 6 && (
            <>
              <StepTitle sub="Handy for finding someone to go with.">How do you like to move?</StepTitle>
              <SearchableChips
                options={FITNESS}
                selected={fitness}
                onToggle={toggle(fitness, setFitness)}
                colors={CHIP_COLORS.fitness}
                placeholder="Search activities"
              />
            </>
          )}

          {step === 7 && (
            <>
              <StepTitle sub="Totally optional, and only ever visible to you. It never shows on your profile — it just helps us understand who's here.">
                Anything you&rsquo;re going through?
              </StepTitle>
              <SearchableChips
                options={STRUGGLES}
                selected={struggles}
                onToggle={toggle(struggles, setStruggles)}
                colors={CHIP_COLORS.struggles}
                placeholder="Search"
                // The long intro copy above eats the room the fourth row
                // needs on a 568px-tall phone.
                rows={3}
              />
            </>
          )}

          {step === 8 && (
            <>
              <div style={{ position: "relative" }}>
                <style>{`
                  @keyframes lgSparkle { 0%,100% { opacity:0; transform:scale(.6) } 50% { opacity:1; transform:scale(1) } }
                `}</style>
                {[
                  { top: -6, left: 6, delay: "0s" },
                  { top: 12, right: 10, delay: ".5s" },
                  { top: 40, left: 30, delay: "1s" },
                ].map((s, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{ position: "absolute", fontSize: 15, animation: `lgSparkle 2.4s ${s.delay} infinite`, ...s }}
                  >
                    ✨
                  </span>
                ))}
                <StepTitle sub="You can change any of this later from your account.">This is you 💌</StepTitle>
              </div>
              <style>{`
                /* The finished card is a hair taller than the smallest phones
                   allow — shrink the preview slightly there instead of making
                   her scroll her own card. zoom affects layout, unlike
                   transform, so the step's height really does come down. */
                @media (max-height: 620px) {
                  .onb-preview { zoom: 0.85; }
                }
              `}</style>
              <div className="onb-preview" style={{ display: "flex", justifyContent: "center", padding: "4px 0 6px" }}>
                <ProfileCardView profile={preview} />
              </div>
            </>
          )}
        </div>

        {/* ---- pinned footer ---- */}
        <div style={{ flex: "none" }}>
          {error ? (
            <p style={{ color: "#b3261e", fontSize: 13, margin: "14px 0 0" }} role="alert">
              {error}
            </p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, paddingTop: 4 }}>
            <button
              className="primary"
              type="button"
              disabled={blocked || pending}
              onClick={() => (step === STEPS - 1 ? finish() : setStep((s) => s + 1))}
              style={{ flex: 1 }}
            >
              {step === 0 ? "Let's go" : step === STEPS - 1 ? (pending ? "Saving…" : "Enter LonelyGirl") : "Continue"}
            </button>
            {step === 0 ? (
              <a
                href="/"
                style={{ color: T.muted, fontSize: 13, textDecoration: "underline", whiteSpace: "nowrap" }}
              >
                Continue as guest
              </a>
            ) : null}
            {step === 7 ? (
              <button
                type="button"
                onClick={() => {
                  setStruggles([]);
                  setStep((s) => s + 1);
                }}
                style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}
              >
                Skip this one
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
