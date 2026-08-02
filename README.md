# LonelyGirl

Next.js app with Supabase authentication (Google OAuth + email/password),
shipped three ways: as a website, as a downloadable desktop app, and as an
iOS/Android app.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Environment variables

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Optional — `/shop` shows previews without it |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Optional |
| `LONELYGIRL_SERVER_URL` | Required for the mobile app only — the deployed site's URL |

## Auth routes

- `/signup` — email/password + Google sign-up
- `/login` — email/password + Google login
- `/account` — protected page (redirects to `/login` when signed out)
- `/auth/callback` — OAuth code exchange
- `/auth/confirm` — email confirmation links

---

# Desktop app

Every page here is server-rendered — async server components reading Supabase
auth cookies, plus middleware and a server action — so there is no static
bundle to drop into a window. The desktop app instead **carries its own copy of
the Next server** (`output: "standalone"`) and Electron boots it on
`127.0.0.1:43110` at launch. Nothing is deployed and nothing is proxied: you
double-click the app and it runs.

```bash
npm run desktop          # dev: next dev + an Electron window on it
npm run desktop:build    # package for the current platform
```

`desktop:build` runs `next build`, folds the static assets and `NEXT_PUBLIC_*`
vars into `.next/standalone` (`scripts/prepare-desktop.mjs`), then hands it to
electron-builder. Output lands in `dist-desktop/`:

| Platform | Command | Artifact |
| --- | --- | --- |
| macOS | `npm run desktop:build:mac` | `.dmg` + `.zip`, arm64 and x64 |
| Windows | `npm run desktop:build:win` | NSIS `.exe` installer |
| Linux | `npm run desktop:build:linux` | `.AppImage` |

**Enable Google sign-in on desktop.** Add this to Supabase → Authentication →
URL Configuration → Redirect URLs:

```
http://localhost:43110/auth/callback
```

The port is fixed rather than random precisely so this URL can be allowlisted
once. If something else already holds 43110 the app steps to the next free port
and still runs — only Google sign-in is affected; email/password is unaffected.

**Builds are unsigned.** Without an Apple Developer account macOS will refuse
the first launch; right-click the app → Open. To sign, set `CSC_LINK` and
`CSC_KEY_PASSWORD` and drop `identity: null` from `electron-builder.yml`.

---

# Mobile app

A phone can't run the Next server, so unlike the desktop build the mobile
shells (Capacitor) load the **deployed** site and add the native pieces around
it: app icon, splash, safe-area handling, Android back button, and a Google
sign-in that works.

```bash
# 1. point it at your deployment (see .env.example)
echo 'LONELYGIRL_SERVER_URL=https://your-deployment' >> .env.local

# 2. push config into the native projects — re-run after any change
npm run mobile:sync

# 3. generate icons + splash screens from build/icon.png
npm run mobile:assets

# 4. open in the platform IDE to run or archive
npm run mobile:ios
npm run mobile:android
```

`LONELYGIRL_SERVER_URL` is read at **sync** time, not runtime — change it and
re-run `npm run mobile:sync`. If it's unset the app shows the placeholder in
`mobile/www/` explaining what to set, rather than a black screen.

### Prerequisites

| Platform | Needs |
| --- | --- |
| iOS | Full Xcode (not just Command Line Tools) + CocoaPods, then `npx cap add ios` |
| Android | Android Studio + a JDK, then `npm run mobile:android` |

### Enable Google sign-in on mobile

Google refuses to render its consent screen inside an app WebView, so on a
phone the app opens the system browser (SFSafariViewController / Custom Tabs)
and gets control back through a custom URL scheme. Add to the same Supabase
redirect allowlist:

```
com.lonelygirl.app://auth/callback
```

The scheme is registered in `android/app/src/main/AndroidManifest.xml` and, on
iOS, in `ios/App/App/Info.plist`. `app/native-bridge.tsx` catches the deep link
and exchanges the code for a session.

---

## TV wall (the home page)

The home page (`app/tv-wall.tsx`) renders the photographic TV-wall artwork as
a Three.js 2.5D parallax scene — mouse tilts the view (30° / 15° max), each of
the 8 TVs is a raycast hit zone linking to a page, and every screen is LIVE:
the channel clips from `app/tv-clips.ts` (chat bubbles, spotlights, vinyl,
merch tee) and animated static are painted onto the glass every frame, with
the photo's own glass reflections laid back on top.

Everything editable lives in **`lib/tv-wall-config.mjs`** — hit zones, link
URLs (auth-aware), per-TV depth, and each screen's glass quad + what plays on
it. A screen `source` swaps freely between a `channel` painter, animated
`static`, or any `video` file:

```
source: { type: "video", src: "/clips/mine.mp4" }
```

Each TV is a **rigid layer**, not a depth-warped region: a depth map would make
the parallax a per-pixel re-read of one image, so silhouettes become cliffs in
the displacement field and edge pixels smear across them (corners visibly
sliding off the sets). Sprites can't do that. Only the wall and floor are
warped — smooth gradients with no edges to tear — and the gap a shift opens
shows an inpainted background plate.

- `public/final_tv_color.png` is the artwork (2016px). The masks, the
  background plate and the glass-reflection map are generated from it: rerun
  `npm run layers` after any art or config change.
- Depth values in the config now only set how far each set travels relative to
  its neighbours, so they're free to tune — there's no artifact budget.
- Open `/?debug=1` to see hit zones (green) and screen glass (pink) overlaid
  while calibrating coordinates.

---

## App icon

The icon is generated, not hand-drawn — one 1024px source that electron-builder
turns into `.icns`/`.ico` and `@capacitor/assets` turns into the iOS and Android
sets. Edit the scene in `scripts/make-icon.mjs`, then:

```bash
npm run icon           # writes build/icon.png + assets/{icon,logo}.png
npm run mobile:assets  # regenerates the iOS/Android icons and splashes
```

Desktop icons are picked up on the next `desktop:build`, so no extra step there.
