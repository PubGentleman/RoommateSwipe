import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const { recipientId, recipientName, authorEmail, relationship } = await req.json();

  const referenceId = crypto.randomUUID();

  await supabase.from('references').insert({
    id: referenceId,
    recipient_id: recipientId,
    author_name: 'Pending',
    author_email: authorEmail,
    author_relationship: relationship,
    is_verified: false,
  });

  return new Response(
    JSON.stringify({
      success: true,
      message: `Reference request sent to ${authorEmail}`,
      referenceId,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
