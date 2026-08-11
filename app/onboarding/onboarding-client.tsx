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
} from "@/lib/profile-options";
import { CHIP_COLORS, chip, ONBOARDING_RING, SERIF, T } from "@/lib/profile-theme";
import { ProfileCardView, Avatar } from "@/app/profile-card";
import { saveProfile, type ProfileInput } from "@/app/onboarding/actions";
import type { ProfileCard } from "@/lib/profile";

const STEPS = 8;

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
            transition: "background .2s",
          }}
        />
      ))}
    </div>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  colors,
}: {
  options: { id: string; emoji: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  colors: readonly [string, string];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          aria-pressed={selected.includes(o.id)}
          style={chip(selected.includes(o.id), colors[0], colors[1])}
        >
          <span aria-hidden>{o.emoji}</span> {o.label}
        </button>
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
  const [query, setQuery] = useState("");
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

  const neighborhoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? city.neighborhoods.filter((n) => n.toLowerCase().includes(q)) : city.neighborhoods;
  }, [city, query]);

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
    <main className="wl-sky" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div
        className="wl-card"
        style={{
          width: "100%",
          maxWidth: 460,
          background: T.paper,
          borderRadius: 22,
          padding: 26,
          boxShadow: ONBOARDING_RING,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, minHeight: 24 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Back"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 19, color: T.muted, padding: 0, lineHeight: 1 }}
            >
              ←
            </button>
          ) : (
            <span />
          )}
          <span style={{ fontSize: 12, color: T.faint, fontWeight: 600 }}>
            {step + 1} of {STEPS}
          </span>
        </div>

        <ProgressBar step={step} />

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
              <div style={{ flex: 1 }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name"
                  maxLength={40}
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 14px",
                    borderRadius: 11,
                    border: `1.5px solid ${T.tan}`,
                    background: T.inputBg,
                    fontSize: 15,
                    color: T.ink,
                  }}
                />
              </div>
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
                <p style={{ fontSize: 12, color: T.faint, margin: "0 0 8px", fontWeight: 600 }}>or pick a colour</p>
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
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search neighbourhoods"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                borderRadius: 11,
                border: `1.5px solid ${T.tan}`,
                background: T.inputBg,
                fontSize: 14,
                color: T.ink,
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {neighborhoods.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNeighborhood(n)}
                  aria-pressed={neighborhood === n}
                  style={chip(neighborhood === n, ...CHIP_COLORS.neighborhood)}
                >
                  {n}
                </button>
              ))}
              {!neighborhoods.length && (
                <p style={{ fontSize: 13, color: T.faint, margin: 0 }}>
                  Nothing matches that — try a shorter search.
                </p>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle sub="Both optional, and you can hide them later.">The basics</StepTitle>
            <p style={{ fontSize: 12, color: T.faint, margin: "0 0 8px", fontWeight: 600 }}>AGE</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {AGE_RANGES.map((a) => (
                <button key={a} type="button" onClick={() => setAge(age === a ? "" : a)} aria-pressed={age === a} style={chip(age === a, ...CHIP_COLORS.basics)}>
                  {a}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: T.faint, margin: "0 0 8px", fontWeight: 600 }}>WHAT YOU DO</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 200, overflowY: "auto" }}>
              {JOBS.map((j) => (
                <button key={j.id} type="button" onClick={() => setJob(job === j.id ? "" : j.id)} aria-pressed={job === j.id} style={chip(job === j.id, ...CHIP_COLORS.basics)}>
                  <span aria-hidden>{j.emoji}</span> {j.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <StepTitle sub="Pick as many as you like.">What are you into?</StepTitle>
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              <ChipGrid options={HOBBIES} selected={hobbies} onToggle={toggle(hobbies, setHobbies)} colors={CHIP_COLORS.hobbies} />
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <StepTitle sub="Handy for finding someone to go with.">How do you like to move?</StepTitle>
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              <ChipGrid options={FITNESS} selected={fitness} onToggle={toggle(fitness, setFitness)} colors={CHIP_COLORS.fitness} />
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <StepTitle sub="Totally optional, and only ever visible to you. It never shows on your profile — it just helps us understand who's here.">
              Anything you&rsquo;re going through?
            </StepTitle>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <ChipGrid options={STRUGGLES} selected={struggles} onToggle={toggle(struggles, setStruggles)} colors={CHIP_COLORS.struggles} />
            </div>
          </>
        )}

        {step === 7 && (
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
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 6px" }}>
              <ProfileCardView profile={preview} />
            </div>
          </>
        )}

        {error ? (
          <p style={{ color: "#b3261e", fontSize: 13, margin: "14px 0 0" }} role="alert">
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <button
            className="primary"
            type="button"
            disabled={blocked || pending}
            onClick={() => (step === STEPS - 1 ? finish() : setStep((s) => s + 1))}
            style={{ flex: 1 }}
          >
            {step === 0 ? "Let's go" : step === STEPS - 1 ? (pending ? "Saving…" : "Enter LonelyGirl") : "Continue"}
          </button>
          {step === 6 ? (
            <button
              type="button"
              onClick={() => {
                setStruggles([]);
                setStep((s) => s + 1);
              }}
              style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Skip this one
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
