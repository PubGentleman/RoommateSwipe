import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { code } = await req.json()

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('INSTAGRAM_CLIENT_ID')!,
        client_secret: Deno.env.get('INSTAGRAM_CLIENT_SECRET')!,
        grant_type: 'authorization_code',
        redirect_uri: Deno.env.get('INSTAGRAM_REDIRECT_URI')!,
        code,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Instagram auth failed' }), { status: 400, headers: corsHeaders })
    }

    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`
    )
    const profileData = await profileRes.json()

    const { error } = await supabase
      .from('profiles')
      .update({
        instagram_handle: profileData.username,
        instagram_verified: true,
        instagram_connected_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, handle: profileData.username }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
