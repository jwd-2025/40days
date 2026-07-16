-- First Forty Days schema
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

create extension if not exists pgcrypto;

-- One row per mentor, linked 1:1 to a Supabase Auth user (email magic-link login).
create table if not exists mentors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- The 41-day lineup (Day 0 - Day 40). Seeded below; edit here if WVBS changes it.
create table if not exists videos (
  day_number int primary key,
  title text not null,
  duration text,
  url text not null
);

-- One row per new convert being walked through the program.
create table if not exists converts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references mentors(id) on delete cascade,
  name text not null,
  phone text,
  email text not null,
  start_date date not null,
  active boolean not null default true,
  access_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- One row per (convert, day) once that day has been scheduled/emailed.
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  convert_id uuid not null references converts(id) on delete cascade,
  day_number int not null references videos(day_number),
  scheduled_date date not null,
  email_sent_at timestamptz,
  watched_at timestamptz,
  unique (convert_id, day_number)
);

create index if not exists idx_converts_mentor on converts(mentor_id);
create index if not exists idx_progress_convert on progress(convert_id);

-- ---------- Row Level Security ----------
alter table mentors enable row level security;
alter table converts enable row level security;
alter table progress enable row level security;
alter table videos enable row level security;

-- Videos are public reference data.
create policy "videos are readable by anyone" on videos
  for select using (true);

-- Mentors can only see/edit their own mentor row.
create policy "mentor reads own row" on mentors
  for select using (auth_user_id = auth.uid());
create policy "mentor updates own row" on mentors
  for update using (auth_user_id = auth.uid());
create policy "mentor inserts own row" on mentors
  for insert with check (auth_user_id = auth.uid());

-- Mentors can only see/manage converts that belong to them.
create policy "mentor reads own converts" on converts
  for select using (
    mentor_id in (select id from mentors where auth_user_id = auth.uid())
  );
create policy "mentor inserts own converts" on converts
  for insert with check (
    mentor_id in (select id from mentors where auth_user_id = auth.uid())
  );
create policy "mentor updates own converts" on converts
  for update using (
    mentor_id in (select id from mentors where auth_user_id = auth.uid())
  );

-- Mentors can read progress rows for their own converts.
create policy "mentor reads progress of own converts" on progress
  for select using (
    convert_id in (
      select c.id from converts c
      join mentors m on m.id = c.mentor_id
      where m.auth_user_id = auth.uid()
    )
  );

-- NOTE: converts never sign in with Supabase Auth. Their view/mark-watched
-- actions go through the SECURITY DEFINER functions below, which validate
-- the per-convert access_token themselves instead of relying on RLS.

-- ---------- Convert-facing RPCs (used by /watch/:token page, anon key only) ----------

create or replace function get_convert_view(p_token uuid)
returns table (
  convert_name text,
  start_date date,
  current_day int,
  day_number int,
  title text,
  duration text,
  url text,
  scheduled_date date,
  watched_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.name,
    c.start_date,
    least(greatest((current_date - c.start_date)::int, 0), 40) as current_day,
    v.day_number,
    v.title,
    v.duration,
    v.url,
    (c.start_date + v.day_number)::date as scheduled_date,
    p.watched_at
  from converts c
  join videos v on true
  left join progress p on p.convert_id = c.id and p.day_number = v.day_number
  where c.access_token = p_token
  order by v.day_number;
$$;

create or replace function mark_day_watched(p_token uuid, p_day int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convert_id uuid;
begin
  select id into v_convert_id from converts where access_token = p_token;
  if v_convert_id is null then
    raise exception 'invalid token';
  end if;

  insert into progress (convert_id, day_number, scheduled_date, watched_at)
  values (v_convert_id, p_day, (select start_date from converts where id = v_convert_id) + p_day, now())
  on conflict (convert_id, day_number)
  do update set watched_at = now();
end;
$$;

-- ---------- Seed the 41-day lineup ----------
insert into videos (day_number, title, duration, url) values
  (0, 'Introduction', '05:04', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-0-introduction'),
  (1, 'What Must I Do After Baptism?', '07:28', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-1-what-must-i-do-after-baptism'),
  (2, 'Every Christian Has a Responsibility', '07:32', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-2-every-christian-has-a-responsibility'),
  (3, 'Characteristics of a Mature Christian (Part 1)', '08:31', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-3-characteristics-of-a-mature-christian-part-1'),
  (4, 'Characteristics of a Mature Christian (Part 2)', '08:10', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-4-characteristics-of-a-mature-christian-part-2'),
  (5, 'A Christian Must Bear Fruit', '06:42', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-5-a-christian-must-bear-fruit'),
  (6, 'Bearing the Fruit of the Spirit (Part 1)', '07:47', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-6-bearing-the-fruit-of-the-spirit-part-1'),
  (7, 'Bearing the Fruit of the Spirit (Part 2)', '07:28', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-7-bearing-the-fruit-of-the-spirit-part-2'),
  (8, 'Bearing the Fruit of the Spirit (Part 3)', '08:07', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-8-bearing-the-fruit-of-the-spirit-part-3'),
  (9, 'You Must Add to Your Faith (Part 1)', '06:59', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-9-you-must-add-to-your-faith-part-1'),
  (10, 'You Must Add to Your Faith (Part 2)', '08:02', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-10-you-must-add-to-your-faith-part-2'),
  (11, 'Learning to Function Within the Body', '07:47', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-11-learning-to-function-within-the-body'),
  (12, 'Where Is Jesus in This?', '05:35', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-12-where-is-jesus-in-this'),
  (13, 'Keeping Your Eyes on Jesus', '06:17', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-13-keeping-your-eyes-on-jesus'),
  (14, 'The Importance of Authority', '07:55', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-14-the-importance-of-authority'),
  (15, 'The Authority of the Bible', '07:01', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-15-the-authority-of-the-bible'),
  (16, 'How We Got the Bible', '06:04', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-16-how-we-got-the-bible'),
  (17, 'Rightly Dividing the Word', '07:05', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-17-rightly-dividing-the-word'),
  (18, 'Why Do We Have the Old Testament?', '05:53', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-18-why-do-we-have-the-old-testament'),
  (19, 'You Can Understand the Bible!', '06:39', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-19-you-can-understand-the-bible'),
  (20, 'How Do We Know the Bible Applies to Us?', '07:28', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-20-how-do-we-know-the-bible-applies-to-us'),
  (21, 'Identifying the Lord''s One, True Church', '07:01', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-21-identifying-the-lord-s-one-true-church'),
  (22, 'The Word Church', '06:52', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-22-the-word-church'),
  (23, 'Why Are There So Many Churches? (Part 1)', '06:28', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-23-why-are-there-so-many-churches-part-1'),
  (24, 'Why Are There So Many Churches? (Part 2)', '05:45', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-24-why-are-there-so-many-churches-part-2'),
  (25, 'Why Are There So Many Churches? (Part 3)', '06:09', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-25-why-are-there-so-many-churches-part-3'),
  (26, 'The Kingdom Is Already Here', '06:28', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-26-the-kingdom-is-already-here'),
  (27, 'When and Where Did the Kingdom Come?', '05:57', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-27-when-and-where-did-the-kingdom-come'),
  (28, 'Who Is the Head of the Church?', '06:40', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-28-who-is-the-head-of-the-church'),
  (29, 'How Is the Church Organized?', '06:54', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-29-how-is-the-church-organized'),
  (30, 'The Mission and Work of the Church', '06:19', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-30-the-mission-and-work-of-the-church'),
  (31, 'True Worship of the Church', '06:24', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-31-true-worship-of-the-church'),
  (32, 'The Lord''s Supper', '06:35', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-32-the-lord-s-supper'),
  (33, 'Singing or Instruments in Worship?', '07:02', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-33-singing-or-instruments-in-worship'),
  (34, 'Prayer', '06:47', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-34-prayer'),
  (35, 'The Offering', '07:36', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-35-the-offering'),
  (36, 'Why Preach?', '06:08', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-36-why-preach'),
  (37, 'Is Attending Worship Necessary?', '06:07', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-37-is-attending-worship-necessary'),
  (38, 'The Godhead', '05:58', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-38-the-godhead'),
  (39, 'The Scheme of Redemption', '05:47', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-39-the-scheme-of-redemption'),
  (40, 'Much More to Learn!', '04:33', 'https://app.wvbs.org/your-first-forty-days-in-the-wilderness/videos/day-40-much-more-to-learn')
on conflict (day_number) do nothing;
