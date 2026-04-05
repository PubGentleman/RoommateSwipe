import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyUser } from '../_shared/pushNotifications.ts'

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

    await notifyUser(supabase, referenceId, {
      type: 'background_check',
      title: status === 'approved' ? 'Verification Complete' : 'Verification Update',
      body: status === 'approved'
        ? 'Your identity verification has been approved!'
        : 'There was an issue with your verification. Please check your profile.',
      data: { status, inquiryId },
    });
  }

  return new Response('ok', { status: 200 })
})
