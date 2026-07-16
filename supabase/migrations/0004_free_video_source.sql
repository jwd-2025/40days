-- Switches video sourcing from app.wvbs.org (WVBS's paid subscription
-- platform, which the series originally pointed to and which has no
-- embed/API permission) to video.wvbs.org - WVBS's free video library,
-- which hosts the exact same "Your First Forty Days" series and whose FAQ
-- (https://video.wvbs.org/about/faq/) explicitly permits embedding any of
-- its videos on another site via their own embed code.
--
-- Run this after 0001-0003. Safe to run more than once.

alter table videos add column if not exists embed_url text;

update videos set
  url = 'https://video.wvbs.org/video/' || slug || '/',
  embed_url = 'https://video.wvbs.org/embed/?ID=' || slug
from (values
  (0, 'day-0-introduction-your-first-forty-days-in-the-wilderness'),
  (1, 'day-1-what-must-i-do-after-baptism-your-first-forty-days-in-the-wilderness'),
  (2, 'day-2-every-christian-has-a-responsibility-your-first-forty-days-in-the-wilderness'),
  (3, 'day-3-characteristics-of-a-mature-christian-part-1-your-first-forty-days-in-the-wilderness'),
  (4, 'day-4-characteristics-of-a-mature-christian-part-2-your-first-forty-days-in-the-wilderness'),
  (5, 'day-5-a-christian-must-bear-fruit-your-first-forty-days-in-the-wilderness'),
  (6, 'day-6-bearing-the-fruit-of-the-spirit-part-1-your-first-forty-days-in-the-wilderness'),
  (7, 'day-7-bearing-the-fruit-of-the-spirit-part-2-your-first-forty-days-in-the-wilderness'),
  (8, 'day-8-bearing-the-fruit-of-the-spirit-part-3-your-first-forty-days-in-the-wilderness'),
  (9, 'day-9-you-must-add-to-your-faith-part-1-your-first-forty-days-in-the-wilderness'),
  (10, 'day-10-you-must-add-to-your-faith-part-2-your-first-forty-days-in-the-wilderness'),
  (11, 'day-11-learning-to-function-within-the-body-your-first-forty-days-in-the-wilderness'),
  (12, 'day-12-where-is-jesus-in-this-your-first-forty-days-in-the-wilderness'),
  (13, 'day-13-keeping-your-eyes-on-jesus-your-first-forty-days-in-the-wilderness'),
  (14, 'day-14-the-importance-of-authority-your-first-forty-days-in-the-wilderness'),
  (15, 'day-15-the-authority-of-the-bible-your-first-forty-days-in-the-wilderness'),
  (16, 'day-16-how-we-got-the-bible-your-first-forty-days-in-the-wilderness'),
  (17, 'day-17-rightly-dividing-the-word-your-first-forty-days-in-the-wilderness'),
  (18, 'day-18-why-do-we-have-the-old-testament-your-first-forty-days-in-the-wilderness'),
  (19, 'day-19-you-can-understand-the-bible-your-first-forty-days-in-the-wilderness'),
  (20, 'day-20-how-do-we-know-the-bible-applies-to-us-your-first-forty-days-in-the-wilderness'),
  (21, 'day-21-identifying-the-lords-one-true-church-your-first-forty-days-in-the-wilderness'),
  (22, 'day-22-the-word-church-your-first-forty-days-in-the-wilderness'),
  (23, 'day-23-why-are-there-so-many-churches-part-1-your-first-forty-days-in-the-wilderness'),
  (24, 'day-24-why-are-there-so-many-churches-part-2-your-first-forty-days-in-the-wilderness'),
  (25, 'day-25-why-are-there-so-many-churches-part-3-your-first-forty-days-in-the-wilderness'),
  (26, 'day-26-the-kingdom-is-already-here-your-first-forty-days-in-the-wilderness'),
  (27, 'day-27-when-and-where-did-the-kingdom-come-your-first-forty-days-in-the-wilderness'),
  (28, 'day-28-who-is-the-head-of-the-church-your-first-forty-days-in-the-wilderness'),
  (29, 'day-29-how-is-the-church-organized-your-first-forty-days-in-the-wilderness'),
  (30, 'day-30-the-mission-and-work-of-the-church-your-first-forty-days-in-the-wilderness'),
  (31, 'day-31-true-worship-of-the-church-your-first-forty-days-in-the-wilderness'),
  (32, 'day-32-the-lords-supper-your-first-forty-days-in-the-wilderness'),
  (33, 'day-33-singing-or-instruments-in-worship-your-first-forty-days-in-the-wilderness'),
  (34, 'day-34-prayer-your-first-forty-days-in-the-wilderness'),
  (35, 'day-35-the-offering-your-first-forty-days-in-the-wilderness'),
  (36, 'day-36-why-preach-your-first-forty-days-in-the-wilderness'),
  (37, 'day-37-is-attending-worship-necessary-your-first-forty-days-in-the-wilderness'),
  (38, 'day-38-the-godhead-your-first-forty-days-in-the-wilderness'),
  (39, 'day-39-the-scheme-of-redemption-your-first-forty-days-in-the-wilderness'),
  (40, 'day-40-much-more-to-learn-your-first-forty-days-in-the-wilderness')
) as slugs(day_number, slug)
where videos.day_number = slugs.day_number;

-- Recreate get_convert_view to also return embed_url, so the convert-facing
-- page can embed the player instead of just linking out. Postgres won't let
-- CREATE OR REPLACE change a table-returning function's column list, so the
-- old version has to be dropped first.
drop function if exists get_convert_view(uuid);

create function get_convert_view(p_token uuid)
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
    least(greatest((current_date - c.start_date)::int, 0), 40) as current_day,
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
