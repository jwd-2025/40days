-- Fixes a bug where the day a lesson email says (e.g. "Day 1") could show a
-- different day's video when the link was actually clicked (e.g. Day 0).
--
-- Cause: get_convert_view() computed "what day is it" with plain
-- `current_date`, which uses whatever timezone the database session
-- happens to be in. The Edge Functions that decide which day's email to
-- send (send-daily-videos, and the client's own day-number display) all
-- compute "today" in UTC instead. For several hours around midnight UTC,
-- depending on the session's timezone, those two could disagree by exactly
-- one day - the email says Day 1 (per the Edge Function's UTC "today"),
-- but the watch page, computed moments later via `current_date`, still
-- thinks it's Day 0.
--
-- Fix: make get_convert_view compute "today" the same explicit way the
-- Edge Functions do - UTC, not session-local - so there's only one
-- definition of "what day is it" anywhere in the app.
--
-- Run this after 0001-0006. Safe to run more than once.

create or replace function get_convert_view(p_token uuid)
returns table (
  convert_name text,
  start_date date,
  current_day int,
  day_number int,
  title text,
  duration text,
  url text,
  embed_url text,
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
    least(greatest(((now() at time zone 'utc')::date - c.start_date)::int, 0), 40) as current_day,
    v.day_number,
    v.title,
    v.duration,
    v.url,
    v.embed_url,
    (c.start_date + v.day_number)::date as scheduled_date,
    p.watched_at
  from converts c
  join videos v on true
  left join progress p on p.convert_id = c.id and p.day_number = v.day_number
  where c.access_token = p_token
  order by v.day_number;
$$;
