"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INTRO_COOKIE } from "@/lib/intro";

function getRedirectBase(origin: string | null) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? origin ?? "http://localhost:3000";
}

/*
 * Where to land after auth. Only same-site paths are honored — anything
 * absolute ("https://…") or protocol-relative ("//…") could bounce a girl
 * who just typed her password onto someone else's site.
 */
function safeNext(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Re-encode a destination onto an error/success redirect so it survives. */
function withNext(url: string, next: string) {
  return next === "/" ? url : url + "&next=" + encodeURIComponent(next);
}

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData);

  if (!email || password.length < 8) {
    redirect(
      withNext(
        "/signup?error=" +
          encodeURIComponent("Enter a valid email and a password of at least 8 characters."),
        next
      )
    );
  }

  // The checkbox is required client-side; this catches direct POSTs.
  if (!formData.get("terms")) {
    redirect(
      withNext(
        "/signup?error=" + encodeURIComponent("You need to agree to the terms to sign up."),
        next
      )
    );
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The confirmation link lands on the callback, which honors ?next=
      emailRedirectTo:
        `${getRedirectBase(origin)}/auth/callback` +
        (next === "/" ? "" : `?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) {
    redirect(withNext("/signup?error=" + encodeURIComponent(error.message), next));
  }

  redirect(
    withNext(
      "/signup?success=" +
        encodeURIComponent("Check your email to confirm your account."),
      next
    )
  );
}

export async function logInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData);

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withNext("/login?error=" + encodeURIComponent(error.message), next));
  }

  // Fresh sign-in gets the static once
  (await cookies()).delete(INTRO_COOKIE);
  revalidatePath("/", "layout");
  redirect(next);
}

/*
 * Permanent account deletion (App Store Guideline 5.1.1(v)). The RPC is a
 * security-definer function that deletes the caller's auth.users row; every
 * app table cascades from it.
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_user_account");
  if (error) {
    redirect("/account?error=" + encodeURIComponent("Couldn't delete the account — try again."));
  }

  await supabase.auth.signOut();
  (await cookies()).delete(INTRO_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(INTRO_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
