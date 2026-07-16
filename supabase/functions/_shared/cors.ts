// Shared CORS headers. Every edge function called directly from the browser
// (identify-role, resend-video-email) needs these on every response,
// including a short-circuit reply to the OPTIONS preflight request the
// browser sends first - without it, the browser blocks the real request
// before it ever reaches Supabase, and supabase-js reports it back as
// "Failed to send a request to the Edge Function" (which looks like the
// function is broken, when really it's just a missing header).

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
