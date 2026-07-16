import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export interface MentorProfile {
  id: string
  name: string | null
  email: string | null
  is_admin: boolean
}

/** Loads the `mentors` row for the signed-in user (works for admins too - admin is just a mentor with is_admin=true). */
export function useMentorProfile(session: Session | null) {
  const [profile, setProfile] = useState<MentorProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('mentors')
      .select('id, name, email, is_admin')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [session])

  return { profile, loading }
}
