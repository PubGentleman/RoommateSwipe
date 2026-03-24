import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const payload = await req.json()
  const eventName = payload.data?.type
  const attributes = payload.data?.attributes || {}
  const referenceId = attributes['reference-id']
  const inquiryId = payload.data?.id

  if (!referenceId || !inquiryId) {
    return new Response('Missing reference', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (eventName === 'inquiry.completed') {
    const status = attributes.status
    const identityVerified = attributes['identity-verified'] === true
    const criminalClear = attributes['criminal-clear'] !== false

    await supabase
      .from('background_checks')
      .update({
        status: status === 'approved' ? 'approved' : 'declined',
        identity_verified: identityVerified,
        criminal_clear: criminalClear,
        completed_at: new Date().toISOString(),
      })
      .eq('provider_inquiry_id', inquiryId)
      .eq('user_id', referenceId)

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', referenceId)
      .single()

    if (profile?.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: status === 'approved' ? 'Background Check Approved' : 'Background Check Update',
          body: status === 'approved'
            ? 'Your verified badge is now showing on your profile.'
            : 'Your background check was not approved. Tap for details.',
          data: { type: 'background_check', status },
        }),
      }).catch((e: any) => console.error('Push error:', e))
    }
  }

  return new Response('ok', { status: 200 })
})
