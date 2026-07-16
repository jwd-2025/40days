# First Forty Days

A small app for mentors walking a new Christian through WVBS's
[Your First Forty Days in the Wilderness](https://video.wvbs.org/program/your-first-forty-days-in-the-wilderness/)
series — one lesson a day for 41 days (Day 0-40), by email, with a progress
dashboard for the mentor.

## How it works

- Anyone opens the app to a single **front-door screen**: an email address,
  with a second field for a **mentor/admin code** (a PIN you choose and
  hand out verbally — see setup step 1.6). A mentor/admin enters their
  email and that code; if it matches, the app signs them straight in, no
  clicking a link, no waiting on an inbox. A convert is dropped **straight
  into their `/watch/<token>` page immediately** by email address alone —
  their token isn't a real login, just an unguessable ID for their own
  page. Nobody ever sees who an email belongs to just by typing it in, and
  a wrong code looks identical to an email that isn't in the system at all.
- A brand-new mentor (not in the system yet) creates their account instead,
  the first time only, via the "create your account" link — that one time
  it does use an actual emailed sign-in link, since there's no `mentors`
  row yet to look up. After that they're in the `mentors` table and can use
  the front door (email + code) like everyone else.
- The mentor adds a new convert: name, email, and a start date.
- Every day, a scheduled job finds anyone whose day 0-40 lands on today, and
  emails them that day's lesson with a link to their personal page.
- The convert doesn't need an account. Their email includes a personal link
  (`/watch/<token>`) where the video for today plays **embedded right on the
  page** (no separate app or account needed), and they can see their full
  41-day calendar and tap "I've watched this" to mark the day done.
- The mentor's dashboard shows each convert's current day, a 🔥 streak
  count, and a red/green calendar grid — built to make missed days visible
  without being punishing, and to make daily consistency easy to see at a
  glance.
- **Admins** (any mentor with `is_admin = true`) get a separate `/admin`
  view: every mentor and every convert across the whole program, the
  ability to promote another mentor to admin, deactivate/reassign/**delete**
  a convert, **delete a mentor account** (once their converts are
  reassigned), and jump into any convert's detail page to resend a specific
  day's email — the "fix issues" role.
- **Removing someone.** A mentor can delete their own convert (and its
  entire watch history) from that convert's detail page — use this for "add
  them by mistake" or "they asked to stop," not just a pause (there's no
  mentor-facing pause; ask an admin to Deactivate instead if you just want
  to stop emails without losing history). Admins can delete any convert the
  same way from `/admin`, and can delete a mentor's account outright once
  that mentor has no converts still assigned to them (reassign first) —
  deleting a mentor also revokes their ability to sign back in at all.
  All deletes ask for confirmation first and can't be undone.

## Why videos are embedded (and where they actually come from)

The series is also available for free at **video.wvbs.org** (WVBS's free
video library — a separate thing from `app.wvbs.org`, the paid subscription
app the videos were originally being linked to). WVBS's own FAQ
(https://video.wvbs.org/about/faq/) explicitly says any video on that site
can be embedded elsewhere using their embed code, so that's what this app
does: each lesson plays in an embedded iframe pointed at
`https://video.wvbs.org/embed/?ID=<slug>`, with a small "open on WVBS"
fallback link underneath in case the embed doesn't load for someone. No
downloading, hosting, or asking permission required — WVBS already grants
it. See `src/data/videos.ts` for the full list of slugs, and
`supabase/migrations/0004_free_video_source.sql` for how the database got
switched over.

## Why email, not SMS or phone numbers at all

Actually texting someone requires a paid SMS provider (Twilio,
MessageBird, etc.) — not something already in place. Since Joey has a Gmail
account, daily lessons go out by email instead, sent from a Supabase Edge
Function via Gmail's SMTP with an **app password** (not your regular Gmail
password — see setup below).

Phone numbers used to be collected too (mentor and convert intake forms
both had a phone field, and the front-door screen looked people up by
phone), but nothing ever actually sent a text - it was purely a lookup key
that email does just as well, since email is already mandatory for
everyone. So phone number collection was dropped entirely
(`supabase/migrations/0006_drop_phone.sql`) in favor of one identifier
instead of two. If you want to text people yourself, or wire up real SMS
later, you'd need to re-add a phone field to the intake forms first.

## One-time setup

### 1. Supabase (database + auth + the daily email job)

1. Create a project at [supabase.com](https://supabase.com) (or reuse an
   existing one).
2. In the SQL editor, run, in order: `supabase/migrations/0001_init.sql`,
   then `0002_cron.sql` (after step 7 below), then
   `0003_admin_and_phone_lookup.sql`, then `0004_free_video_source.sql`,
   then `0005_delete_convert.sql`, then `0006_drop_phone.sql`.
   `0001` creates the tables, security rules, and seeds the 41 videos;
   `0003` adds the admin flag (its phone-lookup columns get removed again
   by `0006` below, but running it in order keeps the migration history
   consistent); `0004` points the videos at the free, embeddable
   video.wvbs.org source instead of the paid app.wvbs.org platform; `0005`
   adds the function that lets a mentor delete their own convert (or an
   admin delete anyone's); `0006` drops phone-number support entirely and
   switches the front-door lookup to email (see "Why email, not SMS or
   phone numbers at all" above).
3. In **Authentication → Providers**, make sure **Email** is enabled, and
   under **Authentication → URL Configuration** set the Site URL to your
   Netlify URL once you have it (step 3 below) so magic links redirect
   correctly.
4. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) locally,
   then from this project folder:
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy send-daily-videos
   supabase functions deploy identify-role
   supabase functions deploy resend-video-email
   supabase functions deploy admin-delete-mentor
   ```
5. Generate a Gmail **app password**: turn on 2-Step Verification on the
   sending Gmail account, then visit
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   and create one for "Mail". You'll get a 16-character password.
6. Set the functions' secrets:
   ```
   supabase secrets set GMAIL_USER=youraddress@gmail.com
   supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   supabase secrets set APP_BASE_URL=https://your-app.netlify.app
   supabase secrets set MENTOR_SIGN_IN_CODE=0608
   ```
   `MENTOR_SIGN_IN_CODE` is the shared PIN every mentor and admin types in
   alongside their email address instead of clicking an emailed link — hand
   it out verbally to whoever you bring on as a mentor. Change it any time
   with the same command (no redeploy needed); anyone who still has the old
   one just won't be able to sign in until you tell them the new one.
7. Open `supabase/migrations/0002_cron.sql`, replace the two placeholders
   (project ref and service role key, both found in **Project Settings →
   API**), and run it in the SQL editor. This schedules the email job to run
   daily at 13:00 UTC — change the cron expression if you want a different
   time.
8. Copy your **Project URL** and **anon public key** (Project Settings →
   API) — you'll need them next.
9. **Make yourself the first admin.** Sign in to the deployed app once
   through "create your account" (so a `mentors` row exists for you), then
   in the SQL editor run:
   ```sql
   update mentors set is_admin = true where email = 'you@example.com';
   ```
   From then on, `/admin` is available to you, and you can promote other
   mentors to admin from that page instead of touching SQL again.

### 2. The web app (GitHub + Netlify)

1. Push this folder to a new GitHub repo:
   ```
   cd new-convert-app
   git init
   git add .
   git commit -m "First Forty Days app"
   git remote add origin <your-empty-github-repo-url>
   git push -u origin main
   ```
2. In Netlify: **Add new site → Import an existing project**, pick the
   GitHub repo. Build command and publish directory are already set via
   `netlify.toml`.
3. Under **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon public key
4. Deploy. Once you have the live URL, go back to Supabase and set
   **Site URL** (Authentication settings) and the `APP_BASE_URL` secret
   (step 1.6 above) to match it, then redeploy the function if you changed
   the secret.

### 3. Try it

- Visit your Netlify URL, create your own mentor account via "create your
  account," then sign the mentor out and back in from the front door using
  your email + the `MENTOR_SIGN_IN_CODE` to confirm that works too.
- Add a convert with **your own** email address and today's date as the
  start date, so you can see Day 0 immediately.
- Manually trigger the email job once to test it without waiting for the
  cron schedule:
  ```
  supabase functions invoke send-daily-videos
  ```
- Check your inbox, click through to the `/watch/<token>` link, and mark
  the day watched — then refresh the mentor dashboard to see it reflected.

## Housekeeping

`src/pages/PhoneEntry.tsx` is a dead stub left over from before the switch
to email — nothing imports it (see `FrontDoor.tsx`). Feel free to
`git rm src/pages/PhoneEntry.tsx`.

## Local development

```
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

## Known limitations / next steps

- Emails go out at a single fixed time (13:00 UTC by default) for everyone,
  not per convert's timezone or preferred hour.
- If a convert's day 41+ passes, they simply stop receiving lessons; there's
  no "completion" email yet — easy to add as a day-41 special case in the
  Edge Function.
- No SMS, and no phone numbers collected at all anymore (see "Why email,
  not SMS or phone numbers at all" above). If you want to text people
  yourself down the road, you'd need to re-add a phone field to the intake
  forms first.
- **Neither mentors/admins nor converts have real per-person verification
  at the front door anymore.** Mentors/admins prove they belong by knowing
  the shared `MENTOR_SIGN_IN_CODE` PIN — anyone who has that code and
  knows a mentor's email address can sign in as that mentor, with full
  edit/admin power if that mentor is an admin. Converts have no code at
  all: typing in an email that matches a convert drops you straight into
  that convert's watch page. Both are intentional trades for
  zero-friction daily use with a small, trusted group — worth revisiting
  if the group grows past "everyone who has the code is someone you trust
  with everyone else's data." The natural upgrade for either is a real
  per-person one-time code (an email OTP they actually have to receive, or
  SMS via Twilio) instead of a shared PIN.
- An email address can only belong to one mentor/admin (enforced by a
  unique index), so if two mentors ever shared an inbox, the second one to
  sign up would hit a database error — worth knowing before onboarding a
  large team. A convert's email isn't required to be unique (e.g. a couple
  sharing a household inbox), same as before.
