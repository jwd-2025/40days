// Supabase Edge Function: admin-delete-mentor
//
// Fully removes a mentor: deletes their Supabase Auth account (so they can't
// sign back in via the phone front-door or email fallback) which cascades
// to delete their `mentors` row (FK: mentors.auth_user_id -> auth.users on
// delete cascade). Uses the service-role key, so admin-ness and every other
// check below is enforced by hand instead of relying on RLS.
//
// Refuses to run if:
//   - the caller isn't an admin
//   - the caller is trying to delete themselves (have another admin do it)
//   - the target mentor still has converts assigned (reassign those first
//     from the admin dashboard - otherwise they'd cascade-delete too, which
//     is surprising for a "remove this mentor" click)

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
      .select('id, is_admin')
      .eq('auth_user_id', user.id)
      .single()
    if (!caller?.is_admin) return json({ error: 'admins only' }, 403)

    const { mentorId } = await req.json()

    const { data: target } = await supabaseAdmin
      .from('mentors')
      .select('id, auth_user_id')
      .eq('id', mentorId)
      .single()
    if (!target) return json({ error: 'mentor not found' }, 404)

    if (target.id === caller.id) {
      return json({ error: "You can't delete your own account — have another admin do it." }, 400)
    }

    const { count } = await supabaseAdmin
      .from('converts')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_id', target.id)
    if ((count ?? 0) > 0) {
      return json({ error: 'This mentor still has converts assigned. Reassign them to someone else first.' }, 400)
    }

    if (target.auth_user_id) {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(target.auth_user_id)
      if (authErr) return json({ error: authErr.message }, 500)
    } else {
      await supabaseAdmin.from('mentors').delete().eq('id', target.id)
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
