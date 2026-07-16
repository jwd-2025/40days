-- Lets a mentor delete their own convert (and everything under it - progress
-- history cascades via the FK in 0001), or an admin delete anyone's convert.
--
-- This mirrors the existing "own records only, unless admin" pattern used by
-- the RLS update policies in 0001/0003, but as a SECURITY DEFINER function
-- rather than a DELETE policy, since deleting a convert needs to also be
-- able to remove its progress rows and progress has no DELETE policy of its
-- own (nor does it need one - nothing else should ever delete progress rows
-- directly).
--
-- Run this after 0001-0004. Safe to run more than once.

create or replace function delete_convert(p_convert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_mentor_id uuid;
  v_caller_mentor_id uuid;
begin
  select mentor_id into v_owner_mentor_id from converts where id = p_convert_id;
  if v_owner_mentor_id is null then
    raise exception 'convert not found';
  end if;

  select id into v_caller_mentor_id from mentors where auth_user_id = auth.uid();

  if not is_admin() and v_caller_mentor_id is distinct from v_owner_mentor_id then
    raise exception 'not authorized to delete this convert';
  end if;

  delete from converts where id = p_convert_id;
end;
$$;

-- Mentor accounts themselves are removed via the admin-delete-mentor Edge
-- Function instead of a SQL function, since fully "removing" a mentor also
-- means revoking their Supabase Auth login (auth.admin.deleteUser), which
-- requires the service-role key and isn't something SQL alone can do. See
-- supabase/functions/admin-delete-mentor.
