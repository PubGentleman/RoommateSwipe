import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { checkType = 'standard' } = await req.json()

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single()

    const personaRes = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PERSONA_API_KEY')}`,
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            'inquiry-template-id': checkType === 'premium'
              ? Deno.env.get('PERSONA_PREMIUM_TEMPLATE_ID')
              : Deno.env.get('PERSONA_STANDARD_TEMPLATE_ID'),
            'reference-id': user.id,
            fields: {
              'name-first': profile?.full_name?.split(' ')[0] || '',
              'name-last': profile?.full_name?.split(' ').slice(1).join(' ') || '',
              'email-address': user.email || '',
            },
          },
        },
      }),
    })

    const personaData = await personaRes.json()
    const inquiryId = personaData.data?.id
    const sessionToken = personaData.data?.attributes?.['session-token']

    if (!inquiryId) throw new Error('Failed to create Persona inquiry')

    const { data: check, error } = await supabase
      .from('background_checks')
      .insert({
        user_id: user.id,
        provider: 'persona',
        provider_inquiry_id: inquiryId,
        status: 'pending',
        check_type: checkType,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        checkId: check.id,
        sessionToken,
        inquiryId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
