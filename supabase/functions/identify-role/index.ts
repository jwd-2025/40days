// Supabase Edge Function: identify-role
//
// The app's "front door": someone types in a phone number, and this function
// figures out whether it belongs to an admin, a mentor, or a convert already
// in the program, then sends THAT PERSON an email to continue - it never
// hands the email address back to the browser, so entering a phone number
// you don't own can't leak who it belongs to.
//
// - admin / mentor -> a normal Supabase magic-link sign-in email (mentors
//                     have real accounts with edit/admin privileges, so they
//                     still need to prove they own that inbox)
// - convert        -> no email step at all - the response hands back their
//                     access token directly so the app can redirect them
//                     straight into /watch/<token>, same as clicking the
//                     link in their daily email. Converts can only ever
//                     mark videos watched with that token, so there's
//                     nothing gained by making them wait on an inbox.
// - not found      -> { found: false } (mentor needs to add them first)
//
// Required secrets: GMAIL_USER, GMAIL_APP_PASSWORD, APP_BASE_URL
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are automatic.)

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
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

    // 2. Convert already in the program? Hand the token straight back so the
    // app can redirect them into /watch/<token> immediately - no email hop.
    const { data: convert } = await supabaseAdmin
      .from('converts')
      .select('access_token')
      .eq('phone_digits', digits)
      .maybeSingle()

    if (convert) {
      return json({ found: true, role: 'convert', token: convert.access_token })
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
