-- Drops phone-number support entirely. Phone was only ever used as a
-- lookup key on the front-door screen - no SMS/Twilio was ever wired up -
-- and email works just as well for that lookup, since it's already
-- mandatory for every mentor and convert. One identifier instead of two.
--
-- Run this after 0001-0005.
--
-- If the unique index below fails to create, it means two mentors already
-- share an email address in your data - fix that by hand (update one of
-- them, or delete/reassign) and re-run this file.

drop index if exists idx_mentors_phone_digits;
drop index if exists idx_converts_phone_digits;

alter table mentors drop column if exists phone_digits;
alter table converts drop column if exists phone_digits;

alter table mentors drop column if exists phone;
alter table converts drop column if exists phone;

-- Normalized, case-insensitive email for lookups (mirrors the old
-- phone_digits pattern, just keyed on email instead). A mentor's email
-- should be unique - Supabase Auth already enforces unique emails on the
-- auth.users row a mentor is linked to - but a convert's email is not
-- required to be unique (e.g. two converts sharing a household inbox),
-- same as phone_digits wasn't unique for converts either.
alter table mentors add column if not exists email_lower text
  generated always as (lower(trim(coalesce(email, '')))) stored;
alter table converts add column if not exists email_lower text
  generated always as (lower(trim(coalesce(email, '')))) stored;

create unique index if not exists idx_mentors_email_lower
  on mentors (email_lower) where email_lower <> '';

create index if not exists idx_converts_email_lower
  on converts (email_lower) where email_lower <> '';
