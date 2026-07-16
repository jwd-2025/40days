-- Adds an admin role and phone-number lookup support.
--
-- Run this in the Supabase SQL editor after 0001_init.sql and 0002_cron.sql.

-- ---------- Admin flag ----------
alter table mentors add column if not exists is_admin boolean not null default false;

-- Helper used inside RLS policies: is the currently-signed-in user an admin?
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from mentors where auth_user_id = auth.uid()), false);
$$;

-- ---------- Normalized phone numbers, for lookup + duplicate detection ----------
-- Strips everything but digits so "(555) 555-0100" and "555-555-0100" match.
alter table mentors add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;
alter table converts add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

-- A phone number should identify exactly one mentor/admin.
create unique index if not exists idx_mentors_phone_digits
  on mentors (phone_digits) where phone_digits <> '';

create index if not exists idx_converts_phone_digits
  on converts (phone_digits) where phone_digits <> '';

-- ---------- Admin RLS policies (in addition to the "own records only" policies from 0001) ----------
create policy "admin reads all mentors" on mentors
  for select using (is_admin());
create policy "admin updates all mentors" on mentors
  for update using (is_admin());

create policy "admin reads all converts" on converts
  for select using (is_admin());
create policy "admin inserts any convert" on converts
  for insert with check (is_admin());
create policy "admin updates all converts" on converts
  for update using (is_admin());

create policy "admin reads all progress" on progress
  for select using (is_admin());

-- ---------- Make yourself the first admin ----------
-- Sign in to the app once as a mentor first (so a row exists in `mentors`),
-- then run:
--   update mentors set is_admin = true where email = 'you@example.com';
