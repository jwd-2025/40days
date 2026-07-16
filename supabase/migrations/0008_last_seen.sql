-- Adds "last seen" tracking so mentors/admins can tell how long it's been
-- since a convert opened their watch page, and admins can tell how long
-- it's been since a mentor/admin last signed in.
--
-- Run this after 0001-0007.

-- ---------- Converts: last time they opened /watch/:token ----------
alter table converts add column if not exists last_seen_at timestamptz;

-- Called once from the convert-facing watch page on every load. Converts
-- never sign in with Supabase Auth, so - like get_convert_view and
-- mark_day_watched - this validates the access_token itself rather than
-- relying on RLS.
create or replace function touch_convert_last_seen(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update converts set last_seen_at = now() where access_token = p_token;
$$;

-- ---------- Mentors/admins: last time they actually signed in ----------
-- Supabase Auth already tracks this on auth.users (last_sign_in_at), but
-- clients have no access to the auth schema at all - this exposes just
-- that one column, and only to admins (mirrors the is_admin()-gated RLS
-- policies from 0003: non-admins get an empty result back, not an error).
create or replace function admin_mentor_last_logins()
returns table (id uuid, last_sign_in_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select m.id, u.last_sign_in_at
  from mentors m
  join auth.users u on u.id = m.auth_user_id
  where is_admin();
$$;
