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
- **Adding a mentor or admin.** An admin sees a "+ Add a mentor or admin"
  button right on their own `/dashboard` (no need to go anywhere else):
  name, email, and a checkbox for whether they're an admin. This creates
  the account and `mentors` row right then and there — no invite email, no
  waiting. They can sign in immediately from the front door with that
  email + the shared mentor/admin code. The same form also exists on
  `/admin`, which admins can still reach via a "Full admin tools" link on
  their dashboard, for the other management actions (reassign, deactivate,
  delete). (There's also a "create your account" self-serve link on the
  front door for a mentor to add themselves via a one-time emailed link,
  in case you'd rather they set themselves up than do it for them - either
  path ends at the same place.)
- The mentor adds a new convert: name, email, and a start date. If that
  start date is today or earlier, their first lesson email goes out
  immediately (same send as a manual resend) instead of waiting for the
  next scheduled run - if the send fails for some reason, the mentor sees
  an alert right there telling them to resend it from the convert's page.
  A future start date is left alone; the daily job picks them up once that
  day actually arrives.
- Every day, a scheduled job finds anyone whose day 0-40 lands on today, and
  emails them that day's lesson with a link to their personal page.
- The convert doesn't need an account. Their email includes a personal link
  (`/watch/<token>`) where the video for today plays **embedded right on the
  page** (no separate app or account needed), and they can see their full
  41-day calendar and tap "I've watched this" to mark the day done.
- The mentor's dashboard shows each convert's current day, a 🔥 streak
  count, and a red/green calendar grid — built to make missed days visible
  without being punishing, and to make daily consistency easy to see at a
  glance. An admin's own `/dashboard` automatically shows *every* convert
  across the whole program, not just their own (their extra admin read
  access applies here too), with the owning mentor's name on each one so
  it's clear whose is whose.
- **Admins** (any mentor with `is_admin = true`) get a separate `/admin`
  view: add a new mentor or admin directly, every mentor and every convert
  across the whole program, the ability to promote another mentor to
  admin, deactivate/reassign/**delete** a convert, **delete a mentor
  account** (once their converts are reassigned), and jump into any
  convert's detail page to resend a specific day's email — the "fix
  issues" role.
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
`https://video.wvbs.org/embed/?ID=<slug>`. There's deliberately no "open on
WVBS instead" exit link anywhere - not on the watch page, not in the daily
email - since that would just be a back door around the app and its
progress tracking. No downloading, hosting, or asking permission required
— WVBS already grants the embed. See `src/data/videos.ts` for the full
list of slugs, and `supabase/migrations/0004_free_video_source.sql` for how
the database got switched over.

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

## Why the day number in an email could disagree with the watch page

There's exactly one place that decides "what day is it for this convert":
today's date minus their start date, clamped to 0-40. Before `0007`, that
was computed three different ways in three different places:

- `send-daily-videos` (which decides which day's email to send) computed
  it in JavaScript using UTC.
- `get_convert_view` (which decides what the watch page shows) computed it
  in SQL using plain `current_date` - whatever timezone the database
  session happens to be in, not necessarily UTC.
- The dashboard's "Day X of 40" display computed it in JavaScript using
  the browser's local timezone.

For several hours around midnight UTC, those could disagree by exactly one
day - e.g. the email correctly says "Day 1," but the link in that email,
clicked a little while later, still shows Day 0, because the database's
notion of "today" hadn't rolled over yet by its own timezone. `0007` makes
`get_convert_view` compute "today" the same explicit way the email job
does (UTC), and `src/lib/progress.ts`'s `elapsedDay()` (used for the
dashboard displays) was changed to match. There's now only one definition
of "what day is it" anywhere in the app.

That closed the timezone-drift gap, but there was a second, more direct way
for an email and its link to disagree: every lesson email's link went to
the convert's *generic* page (`/watch/<token>`), which always shows
whatever day the elapsed-time math currently says is "today" - not
necessarily the day printed in the email. Resending an earlier or later
day on purpose (see "Known limitations" below) made this obvious: resend
"Day 1" while the convert's real elapsed day is still 0, and the link
would show Day 0's video under a "Day 1" subject line. Every email link
now includes `?day=N` (e.g. `/watch/<token>?day=1`), and `ConvertView.tsx`
prefers that specific day over the elapsed-time calculation when present -
so whatever day an email says is exactly the video its link shows,
regardless of where the convert's real progress is. The calendar/streak
below the video still reflects their actual progress either way.

## One-time setup

### 1. Supabase (database + auth + the daily email job)

1. Create a project at [supabase.com](https://supabase.com) (or reuse an
   existing one).
2. In the SQL editor, run, in order: `supabase/migrations/0001_init.sql`,
   then `0002_cron.sql` (after step 7 below), then
   `0003_admin_and_phone_lookup.sql`, then `0004_free_video_source.sql`,
   then `0005_delete_convert.sql`, then `0006_drop_phone.sql`, then
   `0007_fix_day_timezone_mismatch.sql`.
   `0001` creates the tables, security rules, and seeds the 41 videos;
   `0003` adds the admin flag (its phone-lookup columns get removed again
   by `0006` below, but running it in order keeps the migration history
   consistent); `0004` points the videos at the free, embeddable
   video.wvbs.org source instead of the paid app.wvbs.org platform; `0005`
   adds the function that lets a mentor delete their own convert (or an
   admin delete anyone's); `0006` drops phone-number support entirely and
   switches the front-door lookup to email (see "Why email, not SMS or
   phone numbers at all" above); `0007` fixes a bug where the day number in
   a lesson email could disagree with the day shown on the watch page (see
   "Why the day number in an email could disagree with the watch page"
   below).
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
   supabase functions deploy admin-add-mentor
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
9. **Make yourself the first admin.** There's no admin yet to use the
   in-app "add a mentor" form, so this one time only, do it via SQL. Sign
   in to the deployed app once through "create your account" (so a
   `mentors` row exists for you), then in the SQL editor run:
   ```sql
   update mentors set is_admin = true where email = 'you@example.com';
   ```
   From then on, `/admin` is available to you, and you can add every other
   mentor and admin directly from that page instead of touching SQL again.

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

## If you ever get locked out of /admin

The "Make admin"/"Admin" toggle on `/admin` and `/dashboard` is disabled on
your own row specifically so you can't accidentally revoke your own admin
access with nothing else around to undo it. But if it ever happens anyway
(or your `mentors.is_admin` gets out of sync some other way), there's no
in-app way to fix it without at least one working admin, so drop back to
SQL:

```sql
update mentors set is_admin = true where email = 'you@example.com';
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
