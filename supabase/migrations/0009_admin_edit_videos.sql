-- Lets admins correct a video's title, duration, page link, or embed link
-- from inside the app (the /videos page). Until now the `videos` table was
-- read-only to everyone (see 0001), so fixing a bad link meant editing SQL.
--
-- Everything that shows a video (the convert's watch page via
-- get_convert_view, the daily/resent emails, and the mentor/admin video
-- library) reads from this table, so a fix here applies everywhere at once.
--
-- Run this after 0001-0008. Safe to run more than once.

drop policy if exists "admin updates videos" on videos;
create policy "admin updates videos" on videos
  for update using (is_admin()) with check (is_admin());
