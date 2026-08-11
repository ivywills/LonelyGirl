import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AVATAR_COLORS,
  FITNESS_BY_ID,
  HOBBIES_BY_ID,
  JOBS_BY_ID,
  resolve,
  type Option,
} from "@/lib/profile-options";

/*
 * One place for "who is this user". Before this, five pages each repeated the
 * same three-way name fallback off user_metadata; they should all call
 * getProfileCard / getProfileCards instead and only fall back for someone who
 * hasn't been through onboarding yet.
 */

/** Public shape — exactly what public.profile_cards returns. Never includes struggles. */
export type ProfileCard = {
  user_id: string;
  name: string;
  avatar_url: string;
  avatar_color: string;
  city_id: string;
  neighborhood: string;
  /** Empty string when the owner has hidden it — the view enforces this, not the client. */
  age_range: string;
  /** Empty string when the owner has hidden it. */
  job: string;
  hobbies: string[];
  fitness: string[];
  onboarded_at: string | null;
};

/** The owner's own view of themselves, including the private row. */
export type OwnProfile = ProfileCard & {
  show_age: boolean;
  show_job: boolean;
  struggles: string[];
};

const CARD_COLUMNS =
  "user_id, name, avatar_url, avatar_color, city_id, neighborhood, age_range, job, hobbies, fitness, onboarded_at";

/** The pre-profiles fallback. Only for a user with no profile row yet. */
export function fallbackName(user: Pick<User, "user_metadata" | "email">): string {
  return (
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "anon"
  );
}

/** Deterministic colour so a user without a profile still gets a stable avatar. */
export function colorForUserId(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initialOf(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : "";
}

/** True once she's cleared the onboarding gate (name + neighborhood). */
export function isComplete(p: Pick<ProfileCard, "name" | "neighborhood"> | null): boolean {
  return Boolean(p && p.name.trim() && p.neighborhood.trim());
}

export async function getProfileCard(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileCard | null> {
  const { data } = await supabase
    .from("profile_cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProfileCard) ?? null;
}

/** Batch lookup for message lists and attendee rows — one query, not one per user. */
export async function getProfileCards(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, ProfileCard>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return {};
  const { data } = await supabase.from("profile_cards").select(CARD_COLUMNS).in("user_id", ids);
  const out: Record<string, ProfileCard> = {};
  (data ?? []).forEach((p) => {
    out[(p as ProfileCard).user_id] = p as ProfileCard;
  });
  return out;
}

/**
 * Resolve a display name for a user id, preferring the profile and falling back
 * to the old user_metadata logic. `stored` is the denormalised display_name
 * already on messages/attendee rows, used when there's no profile at all.
 */
export function nameFor(
  userId: string,
  cards: Record<string, ProfileCard>,
  stored?: string | null
): string {
  const p = cards[userId];
  if (p?.name?.trim()) return p.name;
  if (stored?.trim()) return stored;
  return "anon";
}

/** The owner's full profile, including the owner-only private row. */
export async function getOwnProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<OwnProfile | null> {
  const [{ data: base }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_private").select("struggles").eq("user_id", userId).maybeSingle(),
  ]);
  if (!base) return null;
  return {
    ...(base as Omit<OwnProfile, "struggles">),
    struggles: (priv?.struggles as string[]) ?? [],
  };
}

/** Merged hobby + fitness chips for the card, capped. Struggles never appear here. */
export function cardTags(p: ProfileCard, cap = 6): Option[] {
  return [
    ...resolve(p.hobbies ?? [], HOBBIES_BY_ID),
    ...resolve(p.fitness ?? [], FITNESS_BY_ID),
  ].slice(0, cap);
}

export function jobOption(p: ProfileCard): Option | null {
  return p.job ? JOBS_BY_ID.get(p.job) ?? null : null;
}

/** Someone who's only done steps 2–3 still gets a clean card, never raw nulls. */
export function isSparse(p: ProfileCard): boolean {
  return !p.age_range && !p.job && !(p.hobbies?.length || p.fitness?.length);
}
