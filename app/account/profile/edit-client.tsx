"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/app/page-header";
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
import { CHIP_COLORS, chip, ONBOARDING_RING, T } from "@/lib/profile-theme";
import { Avatar, ProfileCardView } from "@/app/profile-card";
import SearchableChips, { inputStyle } from "@/app/chip-select";
import { saveProfile, type ProfileInput } from "@/app/onboarding/actions";
import type { OwnProfile, ProfileCard } from "@/lib/profile";

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <p style={{ fontSize: 12, color: T.faint, margin: "0 0 2px", fontWeight: 700, letterSpacing: ".06em" }}>
        {label.toUpperCase()}
      </p>
      {hint ? <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 10px" }}>{hint}</p> : <div style={{ height: 8 }} />}
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    // marginBottom: 0 overrides the global `label` rule, which adds 6px and
    // would nudge the row against whatever follows it.
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        lineHeight: 1.2,
        color: T.ink,
        cursor: "pointer",
        marginTop: 12,
        marginBottom: 0,
      }}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: T.butterDeep, width: 16, height: 16, display: "block" }}
      />
      {label}
    </label>
  );
}

export default function EditProfile({ profile }: { profile: OwnProfile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [avatarUrl] = useState(profile.avatar_url);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [neighborhood, setNeighborhood] = useState(profile.neighborhood);
  const [age, setAge] = useState(profile.age_range);
  const [job, setJob] = useState(profile.job);
  const [hobbies, setHobbies] = useState<string[]>(profile.hobbies ?? []);
  const [fitness, setFitness] = useState<string[]>(profile.fitness ?? []);
  const [struggles, setStruggles] = useState<string[]>(profile.struggles ?? []);
  const [showAge, setShowAge] = useState(profile.show_age);
  const [showJob, setShowJob] = useState(profile.show_job);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const city = cityById(profile.city_id);
  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const neighborhoodOptions: Option[] = useMemo(
    () => city.neighborhoods.map((n) => ({ id: n, emoji: "", label: n })),
    [city]
  );

  const preview: ProfileCard = {
    user_id: profile.user_id,
    name,
    avatar_url: avatarUrl,
    avatar_color: avatarColor,
    city_id: city.id,
    neighborhood,
    age_range: showAge ? age : "",
    job: showJob ? job : "",
    hobbies,
    fitness,
    onboarded_at: profile.onboarded_at,
  };

  function save() {
    setError("");
    const input: ProfileInput = {
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
      show_age: showAge,
      show_job: showJob,
    };
    start(async () => {
      const res = await saveProfile(input);
      if (!res.ok) setError(res.error);
      else {
        // Flash "Saved" just long enough to register, then leave — saving is
        // the end of the task, not a state to sit in.
        setSaved(true);
        setTimeout(() => router.push("/"), 650);
      }
    });
  }

  return (
    <>
      <PageHeader title="Profile" backHref="/account" backLabel="back to your account" />
      {/*
        One long form with a single page scroll. The lists used to sit in five
        nested scroll boxes, which meant a scroll wheel over a chip grid moved
        the inner list instead of the page — search replaces the need for them.
      */}
      <main style={{ padding: "20px 16px 120px", display: "flex", justifyContent: "center" }}>
        <div
          className="wl-card"
          style={{
            width: "100%",
            maxWidth: 520,
            background: T.paper,
            borderRadius: 22,
            padding: "clamp(18px, 4.2vw, 26px)",
            boxShadow: ONBOARDING_RING,
            boxSizing: "border-box",
          }}
        >
          {/*
            The sticky header's back arrow is easy to miss against the dark bar,
            and the pastel card reads as the whole screen. This gives the card
            its own way out — same header row as onboarding: back circle on the
            left, a little pill on the right.
          */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -6, marginBottom: 16 }}>
            <Link
              href="/account"
              aria-label="Back to your account"
              title="Back"
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
                textDecoration: "none",
                flex: "none",
              }}
            >
              ←
            </Link>
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
              }}
            >
              your profile
            </span>
          </div>

          <Section label="Name">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={name} color={avatarColor} url={avatarUrl || undefined} size={64} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="First name"
                style={{ ...inputStyle, fontSize: 15 }}
              />
            </div>
            {!avatarUrl && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {AVATAR_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setAvatarColor(c)} aria-label={`Colour ${c}`}
                    style={{ width: 28, height: 28, padding: 0, borderRadius: "50%", background: c, cursor: "pointer", border: avatarColor === c ? `2.5px solid ${T.ink}` : "2.5px solid transparent" }} />
                ))}
              </div>
            )}
          </Section>

          <Section label="Neighbourhood">
            <SearchableChips
              options={neighborhoodOptions}
              selected={neighborhood ? [neighborhood] : []}
              onToggle={(id) => setNeighborhood(neighborhood === id ? "" : id)}
              colors={CHIP_COLORS.neighborhood}
              placeholder={`Search ${city.label} neighbourhoods`}
            />
          </Section>

          <Section label="Age" hint="Shown on your card only if you leave this ticked.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AGE_RANGES.map((a) => (
                <button key={a} type="button" onClick={() => setAge(age === a ? "" : a)} aria-pressed={age === a} style={chip(age === a, ...CHIP_COLORS.basics)}>
                  {a}
                </button>
              ))}
            </div>
            <Toggle on={showAge} onChange={setShowAge} label="Show my age range on my profile" />
          </Section>

          <Section label="What you do" hint="Shown on your card only if you leave this ticked.">
            <SearchableChips
              options={JOBS}
              selected={job ? [job] : []}
              onToggle={(id) => setJob(job === id ? "" : id)}
              colors={CHIP_COLORS.basics}
              placeholder="Search job fields"
            />
            <Toggle on={showJob} onChange={setShowJob} label="Show what I do on my profile" />
          </Section>

          <Section label="Into">
            <SearchableChips
              options={HOBBIES}
              selected={hobbies}
              onToggle={toggle(hobbies, setHobbies)}
              colors={CHIP_COLORS.hobbies}
              placeholder="Search interests"
            />
          </Section>

          <Section label="Movement">
            <SearchableChips
              options={FITNESS}
              selected={fitness}
              onToggle={toggle(fitness, setFitness)}
              colors={CHIP_COLORS.fitness}
              placeholder="Search activities"
            />
          </Section>

          <Section label="Going through" hint="Only you can see this. It never appears on your profile card.">
            <SearchableChips
              options={STRUGGLES}
              selected={struggles}
              onToggle={toggle(struggles, setStruggles)}
              colors={CHIP_COLORS.struggles}
              placeholder="Search"
            />
          </Section>

          <div style={{ height: 1, background: T.tan2, margin: "4px 0 20px" }} />
          <p style={{ fontSize: 12, color: T.faint, margin: "0 0 12px", fontWeight: 700, letterSpacing: ".06em" }}>
            HOW OTHERS SEE YOU
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <ProfileCardView profile={preview} />
          </div>

          {error ? <p style={{ color: "#b3261e", fontSize: 13 }} role="alert">{error}</p> : null}

          <div style={{ position: "sticky", bottom: 16, marginTop: 20 }}>
            <button className="primary" type="button" onClick={save} disabled={pending} style={{ width: "100%" }}>
              {saved ? "Saved ✓" : pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
