# CLAUDE.md — LonelyGirl

## Working with Ivy

**Communication**
- Concise and direct. Cut preamble and re-explaining what I can see myself.
- Narrate as you work: say what you're doing and why, step by step — especially anything touching my files (creating, moving, deleting, renaming). Never let a permission prompt be the first I hear of an action.
- I give terse instructions ("left align the images", "get rid of the dividing lines") — just do them; don't ask me to confirm obvious intent.
- After changes: short summary of what changed, why, and any tradeoff. End with what I need to do next, if anything.

**How I work**
- Ship-then-refine: working version fast, then rapid small edits. Don't over-plan or demand a full spec.
- I review everything visually. Layout/spacing/alignment quality matters — verify by rendering when possible.
- Batch related fixes into one pass instead of asking one at a time.

**Ambiguity & pushback**
- Make the reasonable call, explain it in a line, keep moving. Don't block on questions the code or context can answer.
- If my request has a downside, do it anyway and flag the tradeoff ("this makes X narrow — your call"). One flag, then respect my decision.
- Push back only on real problems (data loss, security, breaking prod), not style.

**Approvals — always ask first**
- I push to Vercel myself via GitHub Desktop so I can review diffs. Commit locally is fine; never `git push` for me.
- **There is only one database.** Local dev and the Vercel deployment both point at Supabase project `xngmeoxwpmtesmmutaeu` — there is no staging copy, so every migration is a production migration and every row you touch is live data.
- Run them yourself with `psql "$PGURL"`, built from `SUPABASE_DB_URL_DEV` in `.env.local` (gitignored — reference the variable, never print or paste it). The direct host `db.<ref>.supabase.co` is **IPv6-only and unreachable from this Mac**; you must go through the IPv4 pooler at `aws-0-ca-central-1.pooler.supabase.com:5432` with user `postgres.xngmeoxwpmtesmmutaeu`. Port 5432 (session mode), not 6543.
- Keep the `.sql` file in `supabase/` as the source of truth and write it idempotent so it can be re-run. Snapshot anything you're about to overwrite so there's a rollback, and tell me what you ran and what it reported.
- Ask me first before `drop`, `delete`, `truncate`, or a rename that loses data — there's no second database to catch a mistake.
- Never delete or move my files without telling me exactly which files and why, and getting my OK. Same for branches and git history.

## Project

LonelyGirl — chat rooms, playlists, events and merch. Next.js 15 App Router + Supabase, shipped three ways: web (Vercel), desktop (Electron), iOS/Android (Capacitor).

**Commands**
- `npm run dev` — web dev server · `npm run lint` before committing
- `npm run desktop` — Next + Electron together · `npm run desktop:build:mac|win|linux`
- `npm run mobile:sync` then `npm run mobile:ios` / `mobile:android`

**Layout**
- `app/` — App Router: `chat`, `playlists`, `events`, `shop`, `account`, `auth`, `login`, `signup`, `api`
- `lib/supabase/` — client factories · `lib/shopify.ts` — storefront · `lib/runtime.ts` — web vs desktop vs native
- `middleware.ts` — auth guard · `electron/` — desktop shell · `ios/`, `android/` — Capacitor projects
- `supabase/*.sql` — schema, RLS and performance scripts I run by hand in the SQL editor

**Environment** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional Shopify (`NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`), and `LONELYGIRL_SERVER_URL` for mobile.

**Gotchas**
- Auth changes affect three shells — check web, Electron and Capacitor before calling it done.
- Supabase RLS: evaluate `auth.uid()` once per query, not once per row.
- Chat is paginated (50 at a time, 400-message cap) with auto-scroll only when already at the bottom — preserve that when touching the message list.

## Not in this repo
Consulting work (Good Comfort) lives in `~/Documents/consulting/` — never add client files here.
