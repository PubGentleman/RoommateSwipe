import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.203.0/node/crypto.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CHECKR_WEBHOOK_SECRET = Deno.env.get('CHECKR_WEBHOOK_SECRET');

function verifyCheckrSignature(body: string, signature: string | null): boolean {
  if (!CHECKR_WEBHOOK_SECRET || !signature) return false;
  const hmac = createHmac('sha256', CHECKR_WEBHOOK_SECRET);
  hmac.update(body);
  const computed = hmac.digest('hex');
  return computed === signature;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get('x-checkr-signature');

  if (CHECKR_WEBHOOK_SECRET && !verifyCheckrSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const { type, data } = body;

  if (type === 'report.completed') {
    const report = data.object;
    const candidateId = report.candidate_id;
    const status = report.adjudication === 'clear' ? 'clear' : 'consider';

    await supabase
      .from('users')
      .update({
        background_check_status: status,
        background_check_completed_at: new Date().toISOString(),
      })
      .eq('checkr_candidate_id', candidateId);

    if (status === 'clear') {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('checkr_candidate_id', candidateId)
        .single();

      if (userData) {
        await supabase.from('notifications').insert({
          user_id: userData.id,
          type: 'background_check_complete',
          title: 'Background Check Complete',
          body: 'Your background check came back clear. Your profile now shows a verified badge.',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
