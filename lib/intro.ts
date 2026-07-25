/*
 * The static intro plays once per sign-in. The home page checks this cookie
 * on the server so the first paint is already right, the intro sets it once
 * the last chunk has fallen, and signing in or out clears it so the next
 * visit gets the full show again. No max-age — it dies with the browser.
 */
export const INTRO_COOKIE = "lg-intro-seen";
