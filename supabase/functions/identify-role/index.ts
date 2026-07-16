// Supabase Edge Function: identify-role
//
// The app's "front door": someone types in their email address, and this
// function figures out whether it belongs to an admin, a mentor, or a
// convert already in the program. (Phone numbers used to be the lookup key
// here, but nothing ever actually used them - no SMS/Twilio was ever wired
// up - so email does the same job with one less field to collect. See
// supabase/migrations/0006_drop_phone.sql.)
//
// - admin / mentor -> must also supply the shared MENTOR_SIGN_IN_CODE (a PIN
//                     the admin hands out verbally to every mentor - see
//                     README). If it matches, we mint a real Supabase Auth
//                     session for that mentor's account server-side (via
//                     admin.generateLink + verifyOtp) and hand the session
//                     tokens straight back - so the browser can sign them in
//                     immediately with zero email step. If the code is
//                     missing/wrong, we say so without ever revealing
//                     whether the email actually belongs to a mentor.
// - convert        -> no code, no email round-trip - the response hands back
//                     their access token directly so the app can redirect
//                     them straight into /watch/<token>, same as clicking
//                     the link in their daily email. Converts can only ever
//                     mark videos watched with that token, so there's
//                     nothing gained by making them wait on anything.
// - not found      -> { found: false } (mentor needs to add them first)
//
// Required secrets: MENTOR_SIGN_IN_CODE
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are automatic.)
//
// NOTE ON THE SECURITY TRADE-OFF: a shared code known to every mentor means
// anyone who has that code AND knows a mentor's email address can sign in
// as that mentor - there's no per-person proof of identity anymore, unlike
// the old magic-link flow. That's the trade this screen is built for: less
// friction for a small, trusted group of mentors, at the cost of real
// per-person verification. If that stops being an acceptable trade, the
// natural upgrade is a real one-time code sent to that person (email OTP
// they actually have to receive, or SMS via Twilio) instead of a shared PIN.

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
const MENTOR_SIGN_IN_CODE = Deno.env.get('MENTOR_SIGN_IN_CODE') ?? ''

function normalizeEmail(email: string) {
  return (email ?? '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    const { email, code } = await req.json()
    const normalized = normalizeEmail(email)
    if (!normalized.includes('@')) {
      return json({ found: false, reason: 'invalid_email' })
    }

    // 1. Admin or mentor?
    const { data: mentor } = await supabaseAdmin
      .from('mentors')
      .select('email, is_admin')
      .eq('email_lower', normalized)
      .maybeSingle()

    if (mentor?.email) {
      if (!MENTOR_SIGN_IN_CODE || code !== MENTOR_SIGN_IN_CODE) {
        // Same response whether the email is a mentor's or not - see the
        // note above about not leaking who's in the mentors table.
        return json({ found: false, reason: 'wrong_code' })
      }

      // Mint a real session for this mentor without ever sending an email:
      // generateLink() creates a one-time code server-side, and verifyOtp()
      // immediately redeems it for session tokens we can hand to the browser.
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: mentor.email,
      })
      const otp = linkData?.properties?.email_otp
      if (linkErr || !otp) {
        return json({ found: false, error: 'Sign-in failed, please try again.' }, 500)
      }

      const { data: verifyData, error: verifyErr } = await supabaseAnon.auth.verifyOtp({
        email: mentor.email,
        token: otp,
        type: 'magiclink',
      })
      if (verifyErr || !verifyData.session) {
        return json({ found: false, error: 'Sign-in failed, please try again.' }, 500)
      }

      return json({
        found: true,
        role: mentor.is_admin ? 'admin' : 'mentor',
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      })
    }

    // 2. Convert already in the program? Hand the token straight back so the
    // app can redirect them into /watch/<token> immediately - no email hop.
    const { data: convert } = await supabaseAdmin
      .from('converts')
      .select('access_token')
      .eq('email_lower', normalized)
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
