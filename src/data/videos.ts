// Source: https://video.wvbs.org/program/your-first-forty-days-in-the-wilderness/
// (WVBS's free video library - not the paid app.wvbs.org platform. Their FAQ
// at https://video.wvbs.org/about/faq/ explicitly permits embedding any video
// from this site on another site using their embed code.)
//
// This list is also loaded into Supabase via supabase/migrations/0001_init.sql
// + 0004_free_video_source.sql (seed data). Keep the two in sync if WVBS
// changes the lineup or slugs.

export interface DayVideo {
  day: number
  title: string
  duration: string
  /** WVBS's own video page - kept as a fallback / "open on WVBS" link. */
  url: string
  /** iframe src for embedding the video directly in the app. */
  embedUrl: string
}

function video(day: number, title: string, duration: string, slug: string): DayVideo {
  return {
    day,
    title,
    duration,
    url: `https://video.wvbs.org/video/${slug}/`,
    embedUrl: `https://video.wvbs.org/embed/?ID=${slug}`,
  }
}

export const VIDEOS: DayVideo[] = [
  video(0, 'Introduction', '05:05', 'day-0-introduction-your-first-forty-days-in-the-wilderness'),
  video(1, 'What Must I Do After Baptism?', '07:29', 'day-1-what-must-i-do-after-baptism-your-first-forty-days-in-the-wilderness'),
  video(2, 'Every Christian Has a Responsibility', '07:33', 'day-2-every-christian-has-a-responsibility-your-first-forty-days-in-the-wilderness'),
  video(3, 'Characteristics of a Mature Christian (Part 1)', '08:32', 'day-3-characteristics-of-a-mature-christian-part-1-your-first-forty-days-in-the-wilderness'),
  video(4, 'Characteristics of a Mature Christian (Part 2)', '08:11', 'day-4-characteristics-of-a-mature-christian-part-2-your-first-forty-days-in-the-wilderness'),
  video(5, 'A Christian Must Bear Fruit', '06:43', 'day-5-a-christian-must-bear-fruit-your-first-forty-days-in-the-wilderness'),
  video(6, 'Bearing the Fruit of the Spirit (Part 1)', '07:48', 'day-6-bearing-the-fruit-of-the-spirit-part-1-your-first-forty-days-in-the-wilderness'),
  video(7, 'Bearing the Fruit of the Spirit (Part 2)', '07:29', 'day-7-bearing-the-fruit-of-the-spirit-part-2-your-first-forty-days-in-the-wilderness'),
  video(8, 'Bearing the Fruit of the Spirit (Part 3)', '08:08', 'day-8-bearing-the-fruit-of-the-spirit-part-3-your-first-forty-days-in-the-wilderness'),
  video(9, 'You Must Add to Your Faith (Part 1)', '07:00', 'day-9-you-must-add-to-your-faith-part-1-your-first-forty-days-in-the-wilderness'),
  video(10, 'You Must Add to Your Faith (Part 2)', '08:03', 'day-10-you-must-add-to-your-faith-part-2-your-first-forty-days-in-the-wilderness'),
  video(11, 'Learning to Function Within the Body', '07:48', 'day-11-learning-to-function-within-the-body-your-first-forty-days-in-the-wilderness'),
  video(12, 'Where Is Jesus in This?', '05:36', 'day-12-where-is-jesus-in-this-your-first-forty-days-in-the-wilderness'),
  video(13, 'Keeping Your Eyes on Jesus', '06:18', 'day-13-keeping-your-eyes-on-jesus-your-first-forty-days-in-the-wilderness'),
  video(14, 'The Importance of Authority', '07:56', 'day-14-the-importance-of-authority-your-first-forty-days-in-the-wilderness'),
  video(15, 'The Authority of the Bible', '07:02', 'day-15-the-authority-of-the-bible-your-first-forty-days-in-the-wilderness'),
  video(16, 'How We Got the Bible', '06:05', 'day-16-how-we-got-the-bible-your-first-forty-days-in-the-wilderness'),
  video(17, 'Rightly Dividing the Word', '07:06', 'day-17-rightly-dividing-the-word-your-first-forty-days-in-the-wilderness'),
  video(18, 'Why Do We Have the Old Testament?', '05:54', 'day-18-why-do-we-have-the-old-testament-your-first-forty-days-in-the-wilderness'),
  video(19, 'You Can Understand the Bible!', '06:40', 'day-19-you-can-understand-the-bible-your-first-forty-days-in-the-wilderness'),
  video(20, 'How Do We Know the Bible Applies to Us?', '07:29', 'day-20-how-do-we-know-the-bible-applies-to-us-your-first-forty-days-in-the-wilderness'),
  video(21, "Identifying the Lord's One, True Church", '07:02', 'day-21-identifying-the-lords-one-true-church-your-first-forty-days-in-the-wilderness'),
  video(22, 'The Word Church', '06:53', 'day-22-the-word-church-your-first-forty-days-in-the-wilderness'),
  video(23, 'Why Are There So Many Churches? (Part 1)', '06:29', 'day-23-why-are-there-so-many-churches-part-1-your-first-forty-days-in-the-wilderness'),
  video(24, 'Why Are There So Many Churches? (Part 2)', '05:46', 'day-24-why-are-there-so-many-churches-part-2-your-first-forty-days-in-the-wilderness'),
  video(25, 'Why Are There So Many Churches? (Part 3)', '06:10', 'day-25-why-are-there-so-many-churches-part-3-your-first-forty-days-in-the-wilderness'),
  video(26, 'The Kingdom Is Already Here', '06:29', 'day-26-the-kingdom-is-already-here-your-first-forty-days-in-the-wilderness'),
  video(27, 'When and Where Did the Kingdom Come?', '05:58', 'day-27-when-and-where-did-the-kingdom-come-your-first-forty-days-in-the-wilderness'),
  video(28, 'Who Is the Head of the Church?', '06:41', 'day-28-who-is-the-head-of-the-church-your-first-forty-days-in-the-wilderness'),
  video(29, 'How Is the Church Organized?', '06:55', 'day-29-how-is-the-church-organized-your-first-forty-days-in-the-wilderness'),
  video(30, 'The Mission and Work of the Church', '06:20', 'day-30-the-mission-and-work-of-the-church-your-first-forty-days-in-the-wilderness'),
  video(31, 'True Worship of the Church', '06:25', 'day-31-true-worship-of-the-church-your-first-forty-days-in-the-wilderness'),
  video(32, "The Lord's Supper", '06:36', 'day-32-the-lords-supper-your-first-forty-days-in-the-wilderness'),
  video(33, 'Singing or Instruments in Worship?', '07:03', 'day-33-singing-or-instruments-in-worship-your-first-forty-days-in-the-wilderness'),
  video(34, 'Prayer', '06:48', 'day-34-prayer-your-first-forty-days-in-the-wilderness'),
  video(35, 'The Offering', '07:37', 'day-35-the-offering-your-first-forty-days-in-the-wilderness'),
  video(36, 'Why Preach?', '06:09', 'day-36-why-preach-your-first-forty-days-in-the-wilderness'),
  video(37, 'Is Attending Worship Necessary?', '06:08', 'day-37-is-attending-worship-necessary-your-first-forty-days-in-the-wilderness'),
  video(38, 'The Godhead', '05:59', 'day-38-the-godhead-your-first-forty-days-in-the-wilderness'),
  video(39, 'The Scheme of Redemption', '05:48', 'day-39-the-scheme-of-redemption-your-first-forty-days-in-the-wilderness'),
  video(40, 'Much More to Learn!', '04:34', 'day-40-much-more-to-learn-your-first-forty-days-in-the-wilderness'),
]
