# First Forty Days

A small app for mentors walking a new Christian through WVBS's
[Your First Forty Days in the Wilderness](https://video.wvbs.org/program/your-first-forty-days-in-the-wilderness/)
series — one lesson a day for 41 days (Day 0-40), by email, with a progress
dashboard for the mentor.

## How it works

- Anyone opens the app to a single **phone number** screen. The app looks
  the number up and emails the right thing to that person: a sign-in link
  for a mentor/admin, or a resend of their personal link for a convert.
  Nobody ever sees who a number belongs to just by typing it in — the app
  only ever emails the account that actually owns that phone number.
- A brand-new mentor (whose phone isn't in the system yet) signs in with
  email instead, the first time only, from the "sign in with email" link.
- The mentor adds a new convert: name, phone, email, and a start date.
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
  ability to promote another mentor to admin, deactivate/reassign a
  convert, and jump into any convert's detail page to resend a specific
  day's email — the "fix issues" role.

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

## Why email instead of SMS

Actually texting a phone number requires a paid SMS provider (Twilio,
MessageBird, etc.) — not something already in place. Since Joey has a Gmail
account, daily lessons go out by email instead, sent from a Supabase Edge
Function via Gmail's SMTP with an **app password** (not your regular Gmail
password — see setup below). The convert's phone number is still captured
when the mentor adds them, in case you want to text them yourself or wire up
SMS later.

## One-time setup

### 1. Supabase (database + auth + the daily email job)

1. Create a project at [supabase.com](https://supabase.com) (or reuse an
   existing one).
2. In the SQL editor, run, in order: `supabase/migrations/0001_init.sql`,
   then `0002_cron.sql` (after step 7 below), then
   `0003_admin_and_phone_lookup.sql`, then `0004_free_video_source.sql`.
   `0001` creates the tables, security rules, and seeds the 41 videos;
   `0003` adds the admin flag and the normalized phone-number lookup
   columns; `0004` points the videos at the free, embeddable
   video.wvbs.org source instead of the paid app.wvbs.org platform.
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
   ```
5. Generate a Gmail **app password**: turn on 2-Step Verification on the
   sending Gmail account, then visit
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   and create one for "Mail". You'll get a 16-character password.
6. Set the functions' secrets (shared by all three functions):
   ```
   supabase secrets set GMAIL_USER=youraddress@gmail.com
   supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   supabase secrets set APP_BASE_URL=https://your-app.netlify.app
   ```
7. Open `supabase/migrations/0002_cron.sql`, replace the two placeholders
   (project ref and service role key, both found in **Project Settings →
   API**), and run it in the SQL editor. This schedules the email job to run
   daily at 13:00 UTC — change the cron expression if you want a different
   time.
8. Copy your **Project URL** and **anon public key** (Project Settings →
   API) — you'll need them next.
9. **Make yourself the first admin.** Sign in to the deployed app once
   through the "sign in with email" fallback (so a `mentors` row exists for
   you), then in the SQL editor run:
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

- Visit your Netlify URL, sign in with your own email as the mentor.
- Add a convert with **your own** email address and today's date as the
  start date, so you can see Day 0 immediately.
- Manually trigger the email job once to test it without waiting for the
  cron schedule:
  ```
  supabase functions invoke send-daily-videos
  ```
- Check your inbox, click through to the `/watch/<token>` link, and mark
  the day watched — then refresh the mentor dashboard to see it reflected.

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
- No SMS. If you later get a Twilio account, the convert's `phone` field is
  already stored and ready to use.
- The phone-number front door identifies *which account* to email, but the
  actual proof of identity is still "you clicked the link in that account's
  email" — same trust level as before, just reached by typing a phone
  number instead of an email address. If you later add Twilio, the natural
  upgrade is a real SMS one-time code at this same screen.
- A phone number can only belong to one mentor/admin (enforced by a unique
  index), so if two mentors ever shared a number, the second one to sign up
  would hit a database error — worth knowing before onboarding a large team.
