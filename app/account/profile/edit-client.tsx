"use client";

import { useMemo, useState, useTransition } from "react";
import PageHeader from "@/app/page-header";
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
import { Avatar, ProfileCardView } from "@/app/profile-card";
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
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink, cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: T.butterDeep, width: 16, height: 16 }} />
      {label}
    </label>
  );
}

export default function EditProfile({ profile }: { profile: OwnProfile }) {
  const [name, setName] = useState(profile.name);
  const [avatarUrl] = useState(profile.avatar_url);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [neighborhood, setNeighborhood] = useState(profile.neighborhood);
  const [query, setQuery] = useState("");
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

  const neighborhoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? city.neighborhoods.filter((n) => n.toLowerCase().includes(q)) : city.neighborhoods;
  }, [city, query]);

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
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    });
  }

  return (
    <>
      <PageHeader title="Edit profile" backHref="/account" backLabel="back to your account" />
      <main style={{ padding: "20px 16px 110px", display: "flex", justifyContent: "center" }}>
        <div
          className="wl-card"
          style={{
            width: "100%",
            maxWidth: 520,
            background: T.paper,
            borderRadius: 22,
            padding: 26,
            boxShadow: ONBOARDING_RING,
            boxSizing: "border-box",
          }}
        >
          <Section label="Name">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={name} color={avatarColor} url={avatarUrl || undefined} size={64} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="First name"
                style={{ flex: 1, boxSizing: "border-box", padding: "11px 14px", borderRadius: 11, border: `1.5px solid ${T.tan}`, background: T.inputBg, fontSize: 15, color: T.ink }}
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
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${city.label} neighbourhoods`}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 11, border: `1.5px solid ${T.tan}`, background: T.inputBg, fontSize: 14, color: T.ink, marginBottom: 12 }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 190, overflowY: "auto" }}>
              {neighborhoods.map((n) => (
                <button key={n} type="button" onClick={() => setNeighborhood(n)} aria-pressed={neighborhood === n} style={chip(neighborhood === n, ...CHIP_COLORS.neighborhood)}>
                  {n}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Age" hint="Shown on your card only if you leave this ticked.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {AGE_RANGES.map((a) => (
                <button key={a} type="button" onClick={() => setAge(age === a ? "" : a)} aria-pressed={age === a} style={chip(age === a, ...CHIP_COLORS.basics)}>
                  {a}
                </button>
              ))}
            </div>
            <Toggle on={showAge} onChange={setShowAge} label="Show my age range on my profile" />
          </Section>

          <Section label="What you do" hint="Shown on your card only if you leave this ticked.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 170, overflowY: "auto", marginBottom: 10 }}>
              {JOBS.map((j) => (
                <button key={j.id} type="button" onClick={() => setJob(job === j.id ? "" : j.id)} aria-pressed={job === j.id} style={chip(job === j.id, ...CHIP_COLORS.basics)}>
                  <span aria-hidden>{j.emoji}</span> {j.label}
                </button>
              ))}
            </div>
            <Toggle on={showJob} onChange={setShowJob} label="Show what I do on my profile" />
          </Section>

          <Section label="Into">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {HOBBIES.map((h) => (
                <button key={h.id} type="button" onClick={() => toggle(hobbies, setHobbies)(h.id)} aria-pressed={hobbies.includes(h.id)} style={chip(hobbies.includes(h.id), ...CHIP_COLORS.hobbies)}>
                  <span aria-hidden>{h.emoji}</span> {h.label}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Movement">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {FITNESS.map((f) => (
                <button key={f.id} type="button" onClick={() => toggle(fitness, setFitness)(f.id)} aria-pressed={fitness.includes(f.id)} style={chip(fitness.includes(f.id), ...CHIP_COLORS.fitness)}>
                  <span aria-hidden>{f.emoji}</span> {f.label}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Going through" hint="Only you can see this — it never appears on your profile card.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {STRUGGLES.map((s) => (
                <button key={s.id} type="button" onClick={() => toggle(struggles, setStruggles)(s.id)} aria-pressed={struggles.includes(s.id)} style={chip(struggles.includes(s.id), ...CHIP_COLORS.struggles)}>
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
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
