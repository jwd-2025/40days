// Supabase Edge Function: identify-role
//
// The app's "front door": someone types in a phone number, and this function
// figures out whether it belongs to an admin, a mentor, or a convert already
// in the program, then sends THAT PERSON an email to continue - it never
// hands the email address back to the browser, so entering a phone number
// you don't own can't leak who it belongs to.
//
// - admin / mentor -> a normal Supabase magic-link sign-in email
// - convert        -> a resend of their personal /watch/<token> link
// - not found      -> { found: false } (mentor needs to add them first)
//
// Required secrets: GMAIL_USER, GMAIL_APP_PASSWORD, APP_BASE_URL
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are automatic.)

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { sendMail, lessonEmailHtml } from '../_shared/mailer.ts'
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const supabaseAnon = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? ''

function digitsOnly(phone: string) {
  return (phone ?? '').replace(/\D/g, '')
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    const { phone } = await req.json()
    const digits = digitsOnly(phone)
    if (digits.length < 7) {
      return json({ found: false, reason: 'invalid_phone' })
    }

    // 1. Admin or mentor?
    const { data: mentor } = await supabaseAdmin
      .from('mentors')
      .select('email, is_admin')
      .eq('phone_digits', digits)
      .maybeSingle()

    if (mentor?.email) {
      await supabaseAnon.auth.signInWithOtp({
        email: mentor.email,
        options: { emailRedirectTo: APP_BASE_URL + '/' },
      })
      return json({ found: true, role: mentor.is_admin ? 'admin' : 'mentor' })
    }

    // 2. Convert already in the program?
    const { data: convert } = await supabaseAdmin
      .from('converts')
      .select('id, name, email, start_date, access_token')
      .eq('phone_digits', digits)
      .maybeSingle()

    if (convert) {
      const dayNumber = Math.min(
        Math.max(
          Math.floor((Date.now() - new Date(convert.start_date).getTime()) / 86_400_000),
          0,
        ),
        40,
      )
      const { data: video } = await supabaseAdmin
        .from('videos')
        .select('title, duration, url')
        .eq('day_number', dayNumber)
        .single()

      if (video) {
        await sendMail(
          convert.email,
          `Your First Forty Days link (Day ${dayNumber})`,
          lessonEmailHtml({
            convertName: convert.name,
            dayNumber,
            title: video.title,
            duration: video.duration,
            url: video.url,
            watchLink: `${APP_BASE_URL}/watch/${convert.access_token}`,
          }),
        )
      }
      return json({ found: true, role: 'convert' })
    }

    // 3. Nobody recognized.
    return json({ found: false })
  } catch (err) {
    return json({ found: false, error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
