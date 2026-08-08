# Room photo credits

Attribution for the room photos, all from Unsplash.

The files live in the Supabase `room-images` bucket under the `seed/` prefix —
not in the repo — so a photo can be replaced from a room's own Settings screen
without a redeploy. Public URLs are
`<SUPABASE_URL>/storage/v1/object/public/room-images/seed/<file>`, and each
room's `chat_rooms.image_url` points at one. Copies of the resized originals
are also in `public/images/rooms/` as the upload source; nothing reads them.

The Unsplash licence doesn't require attribution, but it asks for it and the
photographers earn nothing else from this. This file is the record. It lives in
`docs/` rather than `public/` on purpose — anything under `public/` is served
by Next.js and fetchable at a URL, and these credits aren't meant to be visible
to anyone using the app.

Photos were downloaded at full resolution and resampled to 720px wide for the
room cards (238×106 on screen). Originals are not kept in the repo.

| File | Photographer | Unsplash |
|---|---|---|
| `boundaries.jpg` | Humberto Arellano | https://unsplash.com/photos/N_G2Sqdy9QY |
| `building-habits.jpg` | Jamie Hagan | https://unsplash.com/photos/0Wx3kEFdgjQ |
| `burnout-recovery.jpg` | Kajetan Sumila | https://unsplash.com/photos/217JZXRHi_k |
| `caregiving.jpg` | Jakub Żerdzicki | https://unsplash.com/photos/1D8DB8mLQbE |
| `family-ties.jpg` | jason hu | https://unsplash.com/photos/fWXpjWYCYp0 |
| `focus-deep-work.jpg` | Unseen Studio | https://unsplash.com/photos/s9CC2SKySJM |
| `grief-loss.jpg` | Hümâ H. Yardım | https://unsplash.com/photos/oCPDom0y_yI |
| `home-practice.jpg` | Dane Wetton | https://unsplash.com/photos/AkSJQnem75Y |
| `living-with-anxiety.jpg` | Scott Webb | https://unsplash.com/photos/oRWRlTgBrPo |
| `making-friends-adult.jpg` | Priscilla Du Preez 🇨🇦 | https://unsplash.com/photos/cIfLUEZYLVg |
| `new-in-town.jpg` | Nadine E | https://unsplash.com/photos/r2FVygjQOsM |
| `sleep.jpg` | Zohre Nemati | https://unsplash.com/photos/6sNQftdA3Zs |
| `sober-curious.jpg` | Nathan Dumlao | https://unsplash.com/photos/6VhPY27jdps |
| `starting-over.jpg` | Vitaly Gariev | https://unsplash.com/photos/wS40ELZROLE |
| `strength-training.jpg` | Anastase Maragos | https://unsplash.com/photos/aclkvEMIfL8 |
| `work-stress.jpg` | Mikey Harris | https://unsplash.com/photos/kw0z6RyvC0s |

Each row was matched by checksumming the file in `public/images/rooms/` against
the original download, so the pairings are exact rather than guessed from
filenames.

**Two credits were reconstructed from the Unsplash filename** rather than
supplied directly — Humberto Arellano (`boundaries.jpg`) and Jamie Hagan
(`building-habits.jpg`). Worth confirming against the photo pages above before
this is published anywhere.

## Downloaded but not currently used

Kept here in case one of these gets swapped in later.

| Photographer | Unsplash |
|---|---|
| MARCOS VERGARA | https://unsplash.com/photos/i8QdlU5E0oM |
| Sean Oulashin | https://unsplash.com/photos/KMn4VEeEPR8 |
| Svetlana Kuznetsova | https://unsplash.com/photos/VgItkeIq6Ek |
| Theme Photos | https://unsplash.com/photos/Hx7xdwhj2AY |

## Adding more

Drop the full-res file in, then resample so the repo stays small:

```bash
sips --resampleWidth 720 -s format jpeg -s formatOptions 72 in.jpg --out public/images/rooms/<slug>.jpg
```

Then add a row above and point the room's `image_url` at `/images/rooms/<slug>.jpg`.
