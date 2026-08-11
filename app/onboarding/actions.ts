"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AGE_RANGES,
  AVATAR_COLORS,
  cityById,
  FITNESS_BY_ID,
  HOBBIES_BY_ID,
  JOBS_BY_ID,
  STRUGGLES_BY_ID,
} from "@/lib/profile-options";

export type ProfileInput = {
  name: string;
  avatar_url: string;
  avatar_color: string;
  city_id: string;
  neighborhood: string;
  age_range: string;
  job: string;
  hobbies: string[];
  fitness: string[];
  struggles: string[];
  show_age: boolean;
  show_job: boolean;
};

/*
 * Everything below is re-validated server-side. The client sends option ids, so
 * without this an edited request could write arbitrary strings into the arrays
 * and they'd render as-is on someone else's screen.
 */
function cleanIds(ids: unknown, map: Map<string, unknown>, cap = 40): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !map.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

function cleanProfile(input: ProfileInput) {
  const city = cityById(typeof input.city_id === "string" ? input.city_id : "toronto");
  const neighborhood =
    typeof input.neighborhood === "string" && city.neighborhoods.includes(input.neighborhood)
      ? input.neighborhood
      : "";
  const age =
    typeof input.age_range === "string" && (AGE_RANGES as readonly string[]).includes(input.age_range)
      ? input.age_range
      : "";
  const job = typeof input.job === "string" && JOBS_BY_ID.has(input.job) ? input.job : "";
  const color =
    typeof input.avatar_color === "string" && (AVATAR_COLORS as readonly string[]).includes(input.avatar_color)
      ? input.avatar_color
      : AVATAR_COLORS[0];

  return {
    base: {
      name: String(input.name ?? "").trim().slice(0, 40),
      avatar_url: typeof input.avatar_url === "string" ? input.avatar_url.slice(0, 500) : "",
      avatar_color: color,
      city_id: city.id,
      neighborhood,
      age_range: age,
      job,
      hobbies: cleanIds(input.hobbies, HOBBIES_BY_ID),
      fitness: cleanIds(input.fitness, FITNESS_BY_ID),
      show_age: input.show_age !== false,
      show_job: input.show_job !== false,
    },
    struggles: cleanIds(input.struggles, STRUGGLES_BY_ID),
  };
}

/**
 * Writes the profile in two places: public fields to `profiles`, the "going
 * through" tags to `profile_private`. Both are upserts keyed on user_id, so
 * onboarding and the edit screen can share this.
 */
export async function saveProfile(
  input: ProfileInput,
  opts: { finishOnboarding?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { base, struggles } = cleanProfile(input);

  if (!base.name) return { ok: false, error: "Pick a name first." };
  if (!base.neighborhood) return { ok: false, error: "Pick a neighbourhood first." };

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      ...base,
      ...(opts.finishOnboarding ? { onboarded_at: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  // Separate row, separate write. Only ever touched by its owner.
  const { error: privError } = await supabase
    .from("profile_private")
    .upsert({ user_id: user.id, struggles }, { onConflict: "user_id" });
  if (privError) return { ok: false, error: privError.message };

  revalidatePath("/chat");
  revalidatePath("/events");
  revalidatePath("/account");
  return { ok: true };
}

/** Onboarding's final step — save, then drop her into the app. */
export async function completeOnboarding(input: ProfileInput) {
  const result = await saveProfile(input, { finishOnboarding: true });
  if (!result.ok) return result;
  redirect("/chat");
}
