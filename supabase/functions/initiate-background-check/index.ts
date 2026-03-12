import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const { userId, email } = await req.json();

  await supabase
    .from('users')
    .update({
      background_check_status: 'pending',
    })
    .eq('id', userId);

  return new Response(
    JSON.stringify({
      status: 'pending',
      message: 'Background check initiated. You will be notified when it completes.',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
