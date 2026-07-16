// Supabase Edge Function: admin-add-mentor
//
// Lets an admin create a mentor (or admin) account directly from inside the
// app, instead of asking that person to sign themselves up first. Creates a
// real, pre-confirmed Supabase Auth user (no email sent, no click needed)
// plus their `mentors` row in one step. They can sign in right away from
// the front door using their email address + the shared
// MENTOR_SIGN_IN_CODE - same as any other mentor/admin.
//
// Requires the caller to already be an admin. Uses the service-role key, so
// that check (and the uniqueness check below) is enforced by hand instead
// of relying on RLS.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
      .select('is_admin')
      .eq('auth_user_id', user.id)
      .single()
    if (!caller?.is_admin) return json({ error: 'admins only' }, 403)

    const { name, email, isAdmin } = await req.json()
    const normalizedEmail = (email ?? '').trim().toLowerCase()
    const trimmedName = (name ?? '').trim()
    if (!trimmedName || !normalizedEmail.includes('@')) {
      return json({ error: 'A name and a valid email are required.' }, 400)
    }

    // Pre-confirmed so there's no "verify your email" step - the front
    // door + shared code is the only sign-in gate for this account.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    })
    if (createErr || !created?.user) {
      const message = createErr?.message ?? 'Could not create account.'
      const friendly = /already/i.test(message)
        ? 'Someone with that email already has an account.'
        : message
      return json({ error: friendly }, 400)
    }

    const { error: insertErr } = await supabaseAdmin.from('mentors').insert({
      auth_user_id: created.user.id,
      name: trimmedName,
      email: normalizedEmail,
      is_admin: !!isAdmin,
    })
    if (insertErr) {
      // Don't leave an orphaned auth user behind if the mentors insert failed.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return json({ error: insertErr.message }, 500)
    }

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
