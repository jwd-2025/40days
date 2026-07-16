// Supabase Edge Function: resend-video-email
//
// Manually re-sends a specific day's lesson email to a convert. Used from
// the mentor's convert-detail view and the admin dashboard - e.g. "they say
// they never got Tuesday's email" or "I set the wrong start date, resend
// today's lesson."
//
// Caller must be signed in (mentor or admin) and must either own the
// convert or be an admin - enforced here explicitly, since this function
// uses the service-role key and therefore bypasses RLS.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { sendMail, lessonEmailHtml } from '../_shared/mailer.ts'
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
// Strip any trailing slash(es) - see send-daily-videos/index.ts for why.
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') ?? '').replace(/\/+$/, '')

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(jwt)
    if (!user) return json({ error: 'not signed in' }, 401)

    const { data: caller } = await supabaseAdmin
      .from('mentors')
      .select('id, is_admin')
      .eq('auth_user_id', user.id)
      .single()
    if (!caller) return json({ error: 'no mentor profile' }, 403)

    const { convertId, dayNumber } = await req.json()

    const { data: convert } = await supabaseAdmin
      .from('converts')
      .select('id, mentor_id, name, email, start_date, access_token')
      .eq('id', convertId)
      .single()
    if (!convert) return json({ error: 'convert not found' }, 404)

    if (!caller.is_admin && convert.mentor_id !== caller.id) {
      return json({ error: 'not your convert' }, 403)
    }

    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('title, duration')
      .eq('day_number', dayNumber)
      .single()
    if (!video) return json({ error: 'no video for that day' }, 404)

    await sendMail(
      convert.email,
      `Day ${dayNumber}: ${video.title} (resent)`,
      lessonEmailHtml({
        convertName: convert.name,
        dayNumber,
        title: video.title,
        duration: video.duration,
        watchLink: `${APP_BASE_URL}/watch/${convert.access_token}`,
      }),
    )

    await supabaseAdmin.from('progress').upsert(
      {
        convert_id: convert.id,
        day_number: dayNumber,
        scheduled_date: new Date().toISOString().slice(0, 10),
        email_sent_at: new Date().toISOString(),
      },
      { onConflict: 'convert_id,day_number', ignoreDuplicates: false },
    )

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
