# LonelyGirl

Next.js app with Supabase authentication (Google OAuth + email/password).

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

## Auth routes

- `/signup` — email/password + Google sign-up
- `/login` — email/password + Google login
- `/account` — protected page (redirects to `/login` when signed out)
- `/auth/callback` — OAuth code exchange
- `/auth/confirm` — email confirmation links
