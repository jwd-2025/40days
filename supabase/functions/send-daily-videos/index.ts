// Supabase Edge Function: send-daily-videos
//
// Runs once a day (wired up via pg_cron, see supabase/migrations/0002_cron.sql).
// For every active convert whose program is still within days 0-40, finds the
// video due today, emails it via Gmail SMTP, and records that the email went out.
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   GMAIL_USER            - the Gmail address sending the emails
//   GMAIL_APP_PASSWORD    - a 16-character Gmail "app password" (myaccount.google.com/apppasswords)
//   APP_BASE_URL          - the deployed app URL, e.g. https://your-app.netlify.app
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts'
import { sendMail, lessonEmailHtml } from '../_shared/mailer.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? ''

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const today = new Date().toISOString().slice(0, 10)

  // Every active convert still inside the 41-day window.
  const { data: converts, error } = await supabase
    .from('converts')
    .select('id, name, email, start_date, access_token, active')
    .eq('active', true)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: Record<string, string> = {}

  for (const convert of converts ?? []) {
    const dayNumber = Math.floor(
      (new Date(today).getTime() - new Date(convert.start_date).getTime()) / 86_400_000,
    )
    if (dayNumber < 0 || dayNumber > 40) continue

    // Already emailed today? Skip (keeps the function safe to re-run).
    const { data: existing } = await supabase
      .from('progress')
      .select('email_sent_at')
      .eq('convert_id', convert.id)
      .eq('day_number', dayNumber)
      .maybeSingle()

    if (existing?.email_sent_at) {
      results[convert.email] = `day ${dayNumber} already sent`
      continue
    }

    const { data: video } = await supabase
      .from('videos')
      .select('title, duration')
      .eq('day_number', dayNumber)
      .single()

    if (!video) continue

    // Was yesterday left unwatched? Add a gentle nudge instead of guilt.
    let nudge = ''
    if (dayNumber > 0) {
      const { data: yesterday } = await supabase
        .from('progress')
        .select('watched_at')
        .eq('convert_id', convert.id)
        .eq('day_number', dayNumber - 1)
        .maybeSingle()
      if (!yesterday?.watched_at) {
        nudge = `<p style="color:#8a6d3b;">No worries if yesterday got busy — pick back up today. Consistency beats perfection.</p>`
      }
    }

    const watchLink = `${APP_BASE_URL}/watch/${convert.access_token}`

    await sendMail(
      convert.email,
      `Day ${dayNumber}: ${video.title}`,
      lessonEmailHtml({
        convertName: convert.name,
        dayNumber,
        title: video.title,
        duration: video.duration,
        watchLink,
        nudge,
      }),
    )

    // Upsert the progress row so we don't email this day again.
    await supabase.from('progress').upsert(
      {
        convert_id: convert.id,
        day_number: dayNumber,
        scheduled_date: today,
        email_sent_at: new Date().toISOString(),
      },
      { onConflict: 'convert_id,day_number' },
    )

    results[convert.email] = `sent day ${dayNumber}`
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
